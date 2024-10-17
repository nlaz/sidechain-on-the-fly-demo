const { spawn } = require('child_process');
const fs = require('fs');
const { PassThrough } = require('stream');

const dynamicMixStream = new PassThrough();
let currentProcess;

const THRESHOLD = 0.02;
const RATIO = 4;
const ATTACK = 20;
const RELEASE = 300;

function startContinuousStream() {
  currentProcess = spawn('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-ar', '44100',
    '-ac', '2',
    'pipe:1'
  ]);
  currentProcess.stdout.pipe(dynamicMixStream, { end: false });
}

function triggerPCMProcess() {
   if (currentProcess) {
    currentProcess.kill();
  }

  const pcmProcess = spawn('ffmpeg', [
    '-i', 'bumper.mp3',
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-filter_complex', 'adelay=500[delayed]',
    '-map', '[delayed]',
    '-ar', '44100',
    '-ac', '2',
    'pipe:1'
  ]);

  pcmProcess.stdout.pipe(dynamicMixStream, { end: false });

  pcmProcess.stderr.on('data', (data) => {
    console.error(`PCM Process stderr: ${data}`);
  });

  pcmProcess.on('close', (code) => {
    console.log(`PCM Process exited with code ${code}`);
    startContinuousStream();
  });
}

const filterProcess = spawn('ffmpeg', [
  '-re',
  '-f', 's16le',
  '-ar', '44100',
  '-ac', '2',
  '-i', 'pipe:0',
  '-f', 'mp3',
  '-re', 
  '-i', 'grooves.mp3',
  '-f', 'mp3',
  '-filter_complex', 
  '[0:a]asplit=2[vocals_for_sidechain][vocals_for_mix];' +
  `[1:a][vocals_for_sidechain]sidechaincompress=threshold=${THRESHOLD}:ratio=${RATIO}:attack=${ATTACK}:release=${RELEASE}[compressed_main];` +
  '[compressed_main][vocals_for_mix]amix=inputs=2:duration=shortest[mix];',
  '-map', '[mix]',
  'pipe:1'
]);

const output = fs.createWriteStream('output.mp3');

startContinuousStream();
dynamicMixStream.pipe(filterProcess.stdin);
filterProcess.stdout.pipe(output);

setTimeout(() => {
  triggerPCMProcess();
}, 5000);

setTimeout(() => {
  triggerPCMProcess();
}, 13000);

filterProcess.stderr.on('data', (data) => {
  console.error(`Filter Process stderr: ${data}`);
});

output.on('finish', () => {
  console.log('Processing completed. Output saved to output.mp3');
});