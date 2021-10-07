importScripts("Mp3LameEncoder.min.js");

onmessage = async (e) => {
  let mp3er = new Mp3LameEncoder(48000, 320);
  let chan0 = new Float32Array(e.data[0]);
  let chan1 = new Float32Array(e.data[1]);
  for (let i = 0; i < chan0.length; i+=8192) {
    mp3er.encode([chan0.subarray(i,i+8192),chan1.subarray(i,i+8192)]);
  }
  let encoded = mp3er.finish();
  let arrBuf = await encoded.arrayBuffer();
  
  postMessage(arrBuf, undefined, [arrBuf]);
}