var express = require('express');   //Express Web Server 
var bodyParser = require('body-parser'); //connects bodyParsing middleware
var formidable = require('formidable');
var path = require('path');     //used for file path
var fs =require('fs-extra');    //File System-needed for renaming file etc
const spawn = require("child_process").spawnSync;
const { v4: uuidv4 } = require('uuid');

//uuidv4()

var app = express();
app.use(express.static(path.join(__dirname, 'public')));

/* ========================================================== 
 bodyParser() required to allow Express to see the uploaded files
============================================================ */
app.use(bodyParser({defer: true}));
 app.route('/upload')
 .post(function (req, res, next) {

  var form = new formidable.IncomingForm();
    //Formidable uploads to operating systems tmp dir by default
    form.uploadDir = "./files";       //set upload directory
    form.keepExtensions = true;     //keep file extension

    form.parse(req, async (err, fields, files) => {
        res.setHeader('Content-Type', 'application/json');

        console.info('..validando arquivo');
        console.log(files);
        if ( typeof(files.fileUploaded) == 'undefined' || typeof(files.fileUploaded.mimetype) == 'undefined' || files.fileUploaded.mimetype != 'application/pdf') {
            return res.end(JSON.stringify({ 'status': 'error', 'message': 'Arquivo inválido.' }));
        }
        console.info('arquivo validado');

        console.info('..validando tamanho');
        if ( typeof(fields.maxsize) == 'undefined' || parseInt(fields.maxsize) <= 0.99 ) {
            return res.end(JSON.stringify({ 'status': 'error', 'message': 'Tamanho inválido.' }));
        }
        console.info('tamanho validado');

        console.info('..criando diretório para processo [' + uuidv4() + ']');
        const uuid_generated = uuidv4();
        const processDir = form.uploadDir + '/' + uuid_generated;
        await fs.promises.mkdir(processDir, { recursive: true });
        console.info('diretório criado');

        //const size = files.fileUploaded.size;
        const filepath = files.fileUploaded.filepath;
        const originalFilename = files.fileUploaded.originalFilename;
        //const mimetype = files.fileUploaded.mimetype;
        //const lastModifiedDate = files.fileUploaded.lastModifiedDate;
        const maxSize = fields.maxsize;

        console.info('..salvando arquivo');
        const destination = processDir + '/' + originalFilename;

        fs.rename(filepath, destination, async (err) => {
            if (err)
                throw err;

            console.info('arquivo salvo');
            console.info('..dividindo arquivo em pedaços de ' + maxSize + 'MB');

            spawn("pdf-split-tool", [
                destination,
                '--max-size',
                maxSize,
            ]);

            console.log('arquivo dividido');
            console.info('..Lendo conteúdo da pasta');

            let files = [];

            fs.readdirSync(processDir).forEach(splitted_file_name => {

                if ( splitted_file_name == originalFilename ) {//skip roriginal file
                    return;
                }

                const stats = fs.statSync(processDir  + '/' + splitted_file_name);
                const fileSizeInBytes = stats.size;
                const fileSizeInMegaBytes = fileSizeInBytes / (1024*1024);

                files.push({
                    'file_name': splitted_file_name,
                    'file_size': fileSizeInMegaBytes.toFixed(2) + 'MB',
                });
            });

            console.log('Processo finalizado');

            return res.end(JSON.stringify({ 
                'status': 'ok', 
                'directory': uuid_generated,
                'fileName': originalFilename,
                'splitted_file': files,
            }));
            
        });
    });
});
var server = app.listen(3030, function() {
console.log('Listening on port %d', server.address().port);
});