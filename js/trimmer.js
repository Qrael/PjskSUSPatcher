class Trimmer extends EventTarget {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 48000});
  waver = new WavAudioEncoder(48000,2);
  // wavWorker = new Worker("js/Wav.worker.js");
  mp3Worker = new Worker("js/Mp3.worker.js");
  constructor(blob, fillerSec, resolve) {
    super();
    this.fillerSec = fillerSec;
    blob.arrayBuffer().then((buffer=>{
      this.ctx = this.audioCtx.decodeAudioData(buffer, (audioBuffer=>{
        this.audioBuffer = audioBuffer;
        this.dispatchEvent(new Event("decodeEnd"));
      }).bind(this), err=>console.log(err));
    }).bind(this))
    resolve()
  }
  
  encode(type, resolve) {
    switch (type.toLowerCase()) {
      case "mp3":
        return this.encodeMp3(resolve);
      case "wav":
        return this.encodeWav(resolve);
      default:
        return resolve();
    }
  }
  
  async encodeMp3(resolve) {
    if (this.mp3) {
      resolve();
      this.dispatchEvent(new Event("encodeEnd"));
      return;
    };
    let chan = {
      0: this.audioBuffer.getChannelData(0).slice(48000*this.fillerSec).buffer,
      1: this.audioBuffer.getChannelData(1).slice(48000*this.fillerSec).buffer,
    }
    this.mp3Worker.onmessage = e => {
      this.mp3 = new Blob([e.data], { type: "audio/mpeg" });
      resolve();
      this.dispatchEvent(new Event("encodeEnd"));
    };
    this.mp3Worker.postMessage(chan, [chan[0], chan[1]]);
  }
  
  async encodeWav(resolve) {
    if (this.wav) {
      resolve();
      this.dispatchEvent(new Event("encodeEnd"));
      return;
    };
    this.waver.encode([this.audioBuffer.getChannelData(0).slice(48000*this.fillerSec),this.audioBuffer.getChannelData(1).slice(48000*this.fillerSec)]);
    this.wav = this.waver.finish();
    resolve();
    this.dispatchEvent(new Event("encodeEnd"));
  }
}
