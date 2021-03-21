class Trimmer extends EventTarget {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 48000});
  waver = new WavAudioEncoder(48000,2);
  mp3er = new Mp3LameEncoder(48000, 320);
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
    if (this.mp3) return this.dispatchEvent(new Event("encodeEnd"));
    let chan = {
      0: this.audioBuffer.getChannelData(0).slice(48000*this.fillerSec),
      1: this.audioBuffer.getChannelData(1).slice(48000*this.fillerSec)
    }
    for (let i = 0; i < chan[0].length; i+=8192) {
      this.mp3er.encode([chan[0].subarray(i,i+8192),chan[1].subarray(i,i+8192)]);
    }
    this.mp3 = this.mp3er.finish();
    resolve();
    this.dispatchEvent(new Event("encodeEnd"));
  }
  
  async encodeWav(resolve) {
    if (this.wav) return this.dispatchEvent(new Event("encodeEnd"));
    this.waver.encode([this.audioBuffer.getChannelData(0).slice(48000*this.fillerSec),this.audioBuffer.getChannelData(1).slice(48000*this.fillerSec)]);
    this.wav = this.waver.finish();
    resolve();
    this.dispatchEvent(new Event("encodeEnd"));
  }
}
