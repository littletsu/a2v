const fs = require('fs');
const path = require('path');
const readline = require("readline");

const { exec } = require('child_process');

const defaultAudioFilter = "flac,wav,mp3,aac,opus,ogg,pcm,m4a,aiff"

const commands = [{
    option: '-image',
    aliases: ['-i', '-cover'],
    description: 'Set an image for the video(s).',
    displayArgs: '[path]',
    requiresArgs: true,
    setVar: 'imgPath' 
}, {
    option: '-audio',
    aliases: ['-a'],
    description: 'Set an audio for the video. If a path is specified, multple videos will be rendered.',
    displayArgs: '[path]',
    requiresArgs: true,
    setVar: 'audioPath' 
}, {
    option: '-output',
    aliases: ['-out', '-o', '-v', '-video', '-r'],
    description: 'Set an output path or format for the video(s). If not specified, video(s) will be rendered to the current directory with the original filename in .mp4 format.',
    displayArgs: '[path] (Optional)',
    requiresArgs: true,
    setVar: 'outputPath' 
}, {
    option: '-filter',
    aliases: ['-ext', '-f'],
    description: 'Set a filter to only detect audio with a regex or extensions when rendering from a path with multiple videos.\n\t\tCan be a list of extensions (for example "wav,mp3,flac,aac") or a regex (for example "/song-.*\\.mp3/gm" matches any filename following the format "song-(any characters).mp3")\n\t\tDefaults to "' + defaultAudioFilter + '"',
    displayArgs: '[filter] (Optional)',
    requiresArgs: true,
    setVar: 'audioFilter' 
}, 
{
    option: '-yes',
    aliases: ['-y'],
    description: 'Skip any prompts',
    displayArgs: '',
    requiresArgs: false,
    setVar: 'yes' 
}];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const genCommand = (img, vid, out) => `ffmpeg -loop 1 -i "${img}" -i "${vid}" -c:v libx264 -tune stillimage -c:a copy -pix_fmt yuv420p -lossless 1 -strict -2 -shortest "${out}"`
const isDirectory = (dirPath) => fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
const isRegex = /\/.*\/.*/gm;
const toRegex = (str) => {
    let split = str.split('/');
    let flags = split.pop();
    split.shift();
    return new RegExp(split.join('/'), flags);
}
const toMp4 = str => str.split('.').slice(0,-1).join('.') + '.mp4'


const displayHelp = (m) => {
    console.log(`${m ? m + '\n\n' : ''}a2v -- Render a video with an audio file and an image.\nHelp:\n${commands.sort((a,b) => (a.option > b.option) ? 1 : ((b.option > a.option) ? -1 : 0))
        .map(cmd => `\t${cmd.option} ${cmd.requiresArgs ? cmd.displayArgs + ' ' : ''}- ${cmd.description}`).join('\n')}`);
    process.exit();
}

if(process.argv.length <= 2) {
    displayHelp('Too few arguments.')
} else {
    let argsObj = {};
    process.argv.forEach((arg, i) => {
        let argument = arg.toLowerCase();
        let command = commands.find(command => (command.option === argument) || (command.aliases.indexOf(argument) !== -1));
        if(command) {
            if(command.requiresArgs) {
                if(process.argv[i+1] ? process.argv[i+1].startsWith('-') : true) {
                    argsObj[command.setVar] = null;  
                } else {
                    argsObj[command.setVar] = process.argv[i+1] || null;
                }
            } else {
                argsObj[command.setVar] = true;
            }
        }
    })
    if(!argsObj.audioPath || !argsObj.imgPath) return displayHelp("No image or audio path provided.");
    
    argsObj.audioFilter = argsObj.audioFilter || defaultAudioFilter;

    let ffmpegCmds;
    let parsedFilter = argsObj.audioFilter.match(isRegex) ? toRegex(argsObj.audioFilter) : new RegExp(`.*\\.(${argsObj.audioFilter.split(',').join('|')})`, 'gm');
    console.log(`Regex filter is: ${parsedFilter}`)
    if(isDirectory(argsObj.audioPath)) ffmpegCmds = fs.readdirSync(argsObj.audioPath)
        .filter(dirPath => (dirPath.match(parsedFilter) || [])[0] == dirPath)
        .map(dirPath => 
            genCommand(
                argsObj.imgPath, 
                path.join(argsObj.audioPath, dirPath), 
                toMp4(dirPath)
            )
        )
    else { 
        argsObj.outputPath = argsObj.outputPath || (toMp4(path.basename(argsObj.audioPath)))
        ffmpegCmds = [genCommand(argsObj.imgPath, argsObj.audioPath, argsObj.outputPath)]
        
    }
    console.log(`${ffmpegCmds.length} total commands to execute:\n${ffmpegCmds.join('\n')}`)
    let i = 0;
    const startCmd = () => {
        const proc = exec(ffmpegCmds[i], (err, stdout, stderr) => {
            if(err) {
                console.log(`An error ocurred while executing the command: ${err}`)
            }
            console.log("Done!");
        })
        proc.on('exit', () => {
            i++;
            if(i <= (ffmpegCmds.length-1)) startCmd();
        })
    }

    const start = () => {
        rl.close();
        startCmd();
    }
    
    argsObj.yes ? start() : rl.question("Continue? (Y/N): ", res => {
        if(res.toLowerCase().startsWith("y")) {
            start();
        } else {
            process.exit();
        }
    })
}