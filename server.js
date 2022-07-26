var express = require('express');   //Express Web Server 
var bodyParser = require('body-parser'); //connects bodyParsing middleware
var formidable = require('formidable');
var path = require('path');     //used for file path
var fs =require('fs-extra');    //File System-needed for renaming file etc
const spawn = require("child_process").spawn;
const exec = require("child_process").exec;
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

//uuidv4()

var app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

/* ========================================================== 
 bodyParser() required to allow Express to see the uploaded files
============================================================ */
app.use(bodyParser({defer: true}));

app.route('/').get((req, res, nex)=>{
    return res.status(200).json({success: true});
});

app.route('/upload')
 .post(function (req, res, next) {

  var form = new formidable.IncomingForm();
    //Formidable uploads to operating systems tmp dir by default
    form.uploadDir = "./files";       //set upload directory
    form.keepExtensions = true;     //keep file extension

    form.parse(req, async (err, fields, files) => {
        res.setHeader('Content-Type', 'application/json');

        console.info('..validando arquivo');
        if ( Object.entries(files).length === 0 || typeof(files.fileUploaded) == 'undefined' || typeof(files.fileUploaded.mimetype) == 'undefined' || files.fileUploaded.mimetype != 'application/pdf') {
            console.log('entrou no retorno');
            return res.end(JSON.stringify({ 'status': 'error', 'message': 'Arquivo inválido.' }));
        }
        console.info('arquivo validado');

        console.info('..validando tamanho');
        if ( Object.entries(fields).length === 0 || typeof(fields.maxsize) == 'undefined' || parseInt(fields.maxsize) <= 0.99 ) {
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

            let python_process = exec(`pdf-split-tool "${destination}" --max-size ${maxSize}`);
            
            python_process.stdout.on("data",function(data){
                if (data.includes('Do you want to continue?')) {
                    python_process.stdin.write("y");
                    python_process.stdin.write("\n");
                }
            });

            python_process.stdout.on("close",function(data){

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
});

app.route('/download')
.get(function (req, res, next) {

    if ( typeof(req.query.directory) == `undefined` ) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ 'status': 'error', 'message': 'Diretório não informado.' }));
    }

    if ( typeof(req.query.file) == `undefined` ) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ 'status': 'error', 'message': 'Arquivo não informado.' }));
    }

    var directory = req.query.directory;
    var file = req.query.file;

    var data =fs.readFileSync('./files/' + directory + '/' + file);
    res.contentType("application/pdf");
    return res.send(data);

});
var server = app.listen(3030, function() {
console.log('Listening on port %d', server.address().port);
});