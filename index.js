const { spawn } = require('child_process');
const fs = require('fs');
const { PassThrough } = require('stream');

const dynamicMixStream = new PassThrough();
let silentProcess;

const THRESHOLD = 0.02;
const RATIO = 4;
const ATTACK = 20;
const RELEASE = 300;

function startContinuousStream() {
  silentProcess = spawn('ffmpeg', [
    '-re',
    '-stream_loop', '-1',
    '-f', 'mp3',
    '-i', 'silence.mp3',
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-ar', '44100',
    '-ac', '2',
    'pipe:1'
  ]);

  silentProcess.stderr.on('data', (data) => {
    console.error(`Silent Process stderr: ${data}`);
  });

  silentProcess.stderr.on('error', (err) => {
    console.error(`Silent Process error: ${err}`);
  });
  silentProcess.stdout.pipe(dynamicMixStream, { end: false });
}

function triggerPCMProcess() {
   if (silentProcess) {
    silentProcess.kill();
  }

  const pcmProcess = spawn('ffmpeg', [
    '-i', 'bumper.mp3',
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-filter_complex', 'adelay=500[delayed]',
    '-map', '[delayed]',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ]);

  pcmProcess.stdout.pipe(dynamicMixStream, { end: false });

  pcmProcess.stderr.on('data', (data) => {
    console.error(`PCM Process stderr: ${data}`);
  });

  pcmProcess.stderr.on('error', (err) => {
    console.error(`PCM Process error: ${err}`);
  });

  pcmProcess.on('close', (code) => {
    console.log(`PCM Process exited with code ${code}`);
    startContinuousStream();
  });
}

const currentTrackProcess = spawn('ffmpeg', [
  '-re',
  '-f', 'mp3',
  '-i', "grooves.mp3",
  '-f', 's16le',
  '-acodec', 'pcm_s16le',
  '-ar', '44100',
  'pipe:1'
]);

currentTrackProcess.stderr.on('data', (data) => {
  console.error(`Current Track Process stderr: ${data}`);
});

currentTrackProcess.stderr.on('error', (err) => {
  console.error(`Current Track Process error: ${err}`);
});

const output = fs.createWriteStream('output.mp3');

const filterProcess = spawn('ffmpeg', [
  '-re',
  '-f', 's16le',
  '-ar', '44100',
  '-ac', '2',
  '-i', 'pipe:0',
  '-re',
  '-f', 's16le',
  '-ar', '44100',
  '-ac', '2',
  '-i', 'pipe:0',
  '-filter_complex', 
  '[0:a][1:a]amix=inputs=2:duration=longest[mix]',
  '-map', '[mix]',
  '-f', 'mp3',
  '-ar', '48000',
  '-ac', '2',
  '-b:a', '192k',
  'pipe:1'
]);

filterProcess.stderr.on('data', (data) => {
  console.error(`👋 Filter Process stderr: ${data}`);
});

filterProcess.stderr.on('error', (err) => {
  console.error(`👋 Filter Process error: ${err}`);
});

startContinuousStream();
dynamicMixStream.pipe(filterProcess.stdin);
currentTrackProcess.stdout.pipe(filterProcess.stdin);
filterProcess.stdout.pipe(output);

setTimeout(() => {
  triggerPCMProcess();
}, 10000);

setTimeout(() => {
  triggerPCMProcess();
}, 15000);

output.on('finish', () => {
  console.log('Processing completed. Output saved to output.mp3');
});