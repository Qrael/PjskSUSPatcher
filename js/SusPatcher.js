class Patcher extends EventTarget {
  difficulties = ["easy","normal","hard","expert","master"];
  db = "https://api.pjsek.ai/database/master";
  asset = {
    pjsekai: "https://assets.pjsek.ai/file/pjsekai-assets",
    sekaibest: "https://storage.sekai.best/sekai-assets",
  };
  song = {
    title: "",
    artist: "",
    songid: 0,
    wave: "",
    fillerSec: 0,
    jacket: {url:"",file:null},
    raw: {},
  };
  vocals = {};
  charts = {
    easy: {playlevel:0,difficulty:0,sus:"",url:""},
    normal: {playlevel:0,difficulty:1,sus:"",url:""},
    hard: {playlevel:0,difficulty:2,sus:"",url:""},
    expert: {playlevel:0,difficulty:3,sus:"",url:""},
    master: {playlevel:0,difficulty:4,sus:"",url:""},
    append: {playlevel:0,difficulty:4,sus:"",url:""},
  };
  char = {
    game_character: {},
    outside_character: {},
  }
  constructor(id) {
    super();
    if (id) {
      let http = new XMLHttpRequest();
      http.open("GET", this.db+"/musics?id="+id);
      http.setRequestHeader("Accept", "application/json");
      let onLoad = () => {
        let res = JSON.parse(http.response);
        if (!res.data[0]) {
          return this.dispatchEvent(new Event("ERRNOSONG"));
        }
        this.song.raw = res.data[0];
        this.addSongData({
          title: this.song.raw.title,
          artist: this.song.raw.composer,
          songid: this.song.raw.id,
          jacket: {url:`${this.asset.pjsekai}/startapp/music/jacket/${this.song.raw.assetbundleName}/${this.song.raw.assetbundleName}.png`,file:null},
          fillerSec: this.song.raw.fillerSec,
        });
        http.res();
      };
      http.onload = onLoad.bind(this);
      
      let http2 = new XMLHttpRequest();
      http2.open("GET", this.db+"/gameCharacters?$limit=200");
      http2.setRequestHeader("Accept", "application/json");
      let onLoad2 = () => {
        for (let char of JSON.parse(http2.response).data) {
          this.char.game_character[char.id] = char;
        };
        http2.res();
      }
      http2.onload = onLoad2.bind(this);
      
      let http3 = new XMLHttpRequest();
      http3.open("GET", this.db+"/outsideCharacters?$limit=200");
      http3.setRequestHeader("Accept", "application/json");
      let onLoad3 = () => {
        for (let char of JSON.parse(http3.response).data) {
          this.char.outside_character[char.id] = char;
        };
        http3.res();
      }
      http3.onload = onLoad3.bind(this);
      
      Promise.all([new Promise(res=>http.res=res),new Promise(res=>http2.res=res),new Promise(res=>http3.res=res)]).then((()=>this.dispatchEvent(new Event("ready"))).bind(this))
      http.send();
      http2.send();
      http3.send();
    }    
  };
  
  addSongData(data) {
    if (data) {
      for (let prop in data) {
        if (this.song.hasOwnProperty(prop)) {
          this.song[prop] = data[prop];
        }
      }
    }
  };
  
  loadCharts() {
    let http = new XMLHttpRequest();
    http.open("GET", this.db+"/musicDifficulties?musicId="+this.song.songid);
    http.setRequestHeader("Accept", "application/json");
    let tmp = {}, chartsPromise = [];
    let onLoad = () => {
      for (let chart of JSON.parse(http.response).data) {
        if (!this.charts[chart.musicDifficulty]) this.charts[chart.musicDifficulty] = {playlevel:0,difficulty:0,sus:"",url:""};
        this.charts[chart.musicDifficulty].playlevel = chart.playLevel;
        this.charts[chart.musicDifficulty].url = [
          /* Fallback list of urls to try */
          `${this.asset.pjsekai}/startapp/music/music_score/${("000" + this.song.songid).slice(-4)}_01/${chart.musicDifficulty}`,
          `${this.asset.sekaibest}/music/music_score/${("000" + this.song.songid).slice(-4)}_01_rip/${chart.musicDifficulty}.txt`,
        ];
        tmp[chart.musicDifficulty] = {};
      };
      for (let level of this.difficulties) {
        tmp[level].http = new XMLHttpRequest();
        tmp[level].urlidx = 0;
        chartsPromise.push(new Promise(res=>tmp[level].res=res));
        tmp[level].http.open("GET", this.charts[level].url[0]);
        tmp[level].http.onreadystatechange = onChartDone.bind(this, level);
        tmp[level].http.send();
      }
      Promise.all(chartsPromise).then((()=>this.dispatchEvent(new Event("chartsloaded"))).bind(this));
    }
    let onChartDone = level => {
      if (tmp[level].http.readyState!=4) return;
      if (tmp[level].http.status>=200 && tmp[level].http.status<=299) {
        this.charts[level].sus = tmp[level].http.response.replace(/\r/g, "");
        tmp[level].res();
      } else {
        tryNext.bind(this)(level);
      }
    }
    let tryNext = (level) => {
      tmp[level].urlidx++;
      if (tmp[level].urlidx >=0 && tmp[level].urlidx < this.charts[level].url.length) {
        tmp[level].http = new XMLHttpRequest();
        tmp[level].http.open("GET", this.charts[level].url[tmp[level].urlidx]);
        tmp[level].http.onreadystatechange = onChartDone.bind(this, level);
        tmp[level].http.send();
      } else return null;
    }
    http.onload = onLoad.bind(this);
    http.send();
  }
  
  loadVocals() {
    let tmp = new XMLHttpRequest();
    let tmp2 = {}, vocalsPromise=[];
    tmp.open("GET", `${this.db}/musicVocals?musicId=${this.song.songid}`);
    let onload = () => {
      for (let vocal of JSON.parse(tmp.response).data) {
        this.vocals[vocal.assetbundleName] = vocal;
        this.vocals[vocal.assetbundleName].members = [];
        for (let member of vocal.characters) {
          let c = this.char[member.characterType][member.characterId];
          this.vocals[vocal.assetbundleName].members.push(c.name?c.name:`${c.firstName?c.firstName+" ":""}${c.givenName}`);
        }
        tmp2[vocal.assetbundleName] = vocal;
        tmp2[vocal.assetbundleName].url = [
          /* Fallback list of urls to try */
          `${this.asset.pjsekai}/ondemand/music/long/${vocal.assetbundleName}/${vocal.assetbundleName}.flac`,
          `${this.asset.pjsekai}/ondemand/music/long/${vocal.assetbundleName}/${vocal.assetbundleName}.wav`,
          `${this.asset.sekaibest}/music/long/${vocal.assetbundleName}_rip/${vocal.assetbundleName}.flac`,
          `${this.asset.sekaibest}/music/long/${vocal.assetbundleName}_rip/${vocal.assetbundleName}.mp3`,
        ];
        tmp2[vocal.assetbundleName].urlidx = 0;
        tmp2[vocal.assetbundleName].http = new XMLHttpRequest();
        tmp2[vocal.assetbundleName].http.open("GET", tmp2[vocal.assetbundleName].url[0]);
        tmp2[vocal.assetbundleName].http.responseType = "blob";
        tmp2[vocal.assetbundleName].http.onreadystatechange = onVocalDone.bind(this, vocal.assetbundleName);
        vocalsPromise.push(new Promise(resolve=>{tmp2[vocal.assetbundleName].resolve=resolve}));
        tmp2[vocal.assetbundleName].http.send();
      }
      Promise.all(vocalsPromise).then((()=>{this.dispatchEvent(new Event("vocalsloaded"))}).bind(this));
    }
    let onVocalDone = assetbundleName => {
      if (tmp2[assetbundleName].http.readyState!=4) return;
      if (tmp2[assetbundleName].http.status>=200 && tmp2[assetbundleName].http.status<=299) {
        this.vocals[assetbundleName].file = tmp2[assetbundleName].http.response;
        this.vocals[assetbundleName].trim = new Trimmer(tmp2[assetbundleName].http.response, this.song.fillerSec, tmp2[assetbundleName].resolve);
      } else {
        tryNext.bind(this)(assetbundleName);
      }
    }
    let tryNext = (assetbundleName) => {
      tmp2[assetbundleName].urlidx++;
      if (tmp2[assetbundleName].urlidx >=0 && tmp2[assetbundleName].urlidx < tmp2[assetbundleName].url.length) {
        tmp2[assetbundleName].http = new XMLHttpRequest();
        tmp2[assetbundleName].http.open("GET",tmp2[assetbundleName].url[tmp2[assetbundleName].urlidx]);
        tmp2[assetbundleName].http.responseType = "blob";
        tmp2[assetbundleName].http.onreadystatechange = onVocalDone.bind(this, assetbundleName);
        tmp2[assetbundleName].http.send();
      } else return null;
    }
    tmp.onload = onload.bind(this);
    tmp.send();
  }
  
  loadJacket() {
    let tmp = new XMLHttpRequest();
    tmp.open("GET", this.song.jacket.url);
    let onLoad = ()=>{
      this.song.jacket.file = tmp.response;
      this.dispatchEvent(new Event("jacketloaded"));
    };
    tmp.responseType = "blob";
    tmp.onload=onLoad.bind(this);
    tmp.send();
  }
  
  loadMedia() {
    let m=()=>{},j=()=>{},c=()=>{};
    Promise.all([new Promise(resolve=>m=resolve),new Promise(resolve=>j=resolve),new Promise(resolve=>c=resolve)]).then((()=>this.dispatchEvent(new Event("medialoaded"))).bind(this))
    this.addEventListener("vocalsloaded",m);
    this.addEventListener("jacketloaded",j);
    this.addEventListener("chartsloaded",c);
    this.loadVocals();
    this.loadJacket();
    this.loadCharts();
  }
  
  patchSus() {
    let vocal = Array.from(this.vocalselect).filter(el=>el.checked==true);
    let audtype = Array.from(this.audtype).filter(el=>el.checked==true)[0];
    for (let i=0; i<this.difficulties.length; i++) {
      let tmp = this.charts[this.difficulties[i]].sus.split("\n");
      let metadata = {
        id: this.song.songid,
        title: this.song.title,
        artist: this.song.artist,
        jacket: `${this.song.raw.assetbundleName}.png`,
        waveoffset: 0,
        difficulty: i,
        playlevel: this.charts[this.difficulties[i]].playlevel,
      }
      if (vocal.length) {
        metadata.wave = `${vocal[0].getAttribute("value")}.${audtype.getAttribute("value")}`;
      }

      tmp = this.patchMetadata(tmp, metadata);
      tmp = this.patchOneChart(tmp);

      this.charts[this.difficulties[i]].sus = tmp.join("\n");
    }
  }

  patchMetadata(sus, {id, title, artist, designer, jacket, wave, waveoffset, difficulty, playlevel}) {
    let i;
    if (playlevel) {
      i = sus.findIndex(cmd=>cmd.startsWith("#PLAYLEVEL"));
      if (i!==-1) sus[i]=`#PLAYLEVEL ${playlevel}`;
      else sus.splice(1,0,`#PLAYLEVEL ${playlevel}`);
    };
    if (difficulty) {
      i = sus.findIndex(cmd=>cmd.startsWith("#DIFFICULTY"));
      if (i!==-1) sus[i]=`#DIFFICULTY ${difficulty}`;
      else sus.splice(1,0,`#DIFFICULTY ${difficulty}`);
    };
    if (waveoffset) {
      i = sus.findIndex(cmd=>cmd.startsWith("#WAVEOFFSET"));
      if (i!==-1) sus[i]=`#WAVEOFFSET ${waveoffset}`;
      else sus.splice(1,0,`#WAVEOFFSET ${waveoffset}`);
    };
    if (wave) {
      i = sus.findIndex(cmd=>cmd.startsWith("#WAVE"));
      if (i!==-1) sus[i]=`#WAVE "${wave}"`;
      else sus.splice(1,0,`#WAVE "${wave}"`);
    }
    if (jacket) {
      i = sus.findIndex(cmd=>cmd.startsWith("#JACKET"));
      if (i!==-1) sus[i]=`#JACKET "${jacket}"`;
      else sus.splice(1,0,`#JACKET "${jacket}"`);
    }
    if (artist) {
      i = sus.findIndex(cmd=>cmd.startsWith("#ARTIST"));
      if (i!==-1) sus[i]=`#ARTIST "${artist}"`;
      else sus.splice(1,0,`#ARTIST "${artist}"`);
    }
    if (designer) {
      i = sus.findIndex(cmd=>cmd.startsWith("#DESIGNER"));
      if (i!==-1) sus[i]=`#DESIGNER "${designer}"`;
      else sus.splice(1,0,`#DESIGNER "${designer}"`);
    }
    if (title) {
      i = sus.findIndex(cmd=>cmd.startsWith("#TITLE"));
      if (i!==-1) sus[i]=`#TITLE "${title}"`;
      else sus.splice(1,0,`#TITLE "${title}"`);
    }
    if (id) {
      i = sus.findIndex(cmd=>cmd.startsWith("#SONGID"));
      if (i!==-1) sus[i]=`#SONGID "${id}"`;
      else sus.splice(1,0,`#SONGID "${id}"`);
    }
    return sus;
  }

  patchOneChart(sus) {
    let info = "This chart is created for Project Sekai: Colorful Stage, and patched as playable SUS with PjskSUSPatcher."
    if (!sus[1].startsWith(info)) {
      // The chart has not been patched yet, patch it now
      
      // Remove skills, fever and fever chance
      let tmp = sus.filter(cmd=>!/^\#\d{3}1[0f]:/gi.test(cmd));
      
      // Find air downs
      let tmp2 = [];
      tmp.forEach(cmd=>{
        let match = [...cmd.matchAll(/#(\d{3})5(\w):\s?(((?:(?:\w\w)*)?)[256](?=[^0])(?:\w)(?:\w*)?)/gi)];
        if (match.length) {
          tmp2.push(...match);
        }
      });
      // Remove air downs and taps associated with them
      for (let bar of tmp2) {
        let tmp3=[];
        let j = tmp.findIndex(cmd=>cmd.startsWith(bar[0]));
        if (j!=-1) {
          let match = (new RegExp(`(#\\d{3}5\\w:\\s?)(?:(?:\\w\\w)*)?[256][^0](?:(?:\\w\\w)*)?`,"gi")).exec(tmp[j]);
          for (let k = 0; k < bar[3].length; k+=2) {
            if (["2","5","6"].includes(bar[3][k])) {
              tmp3.push(k);
              tmp[j] = tmp[j].substring(0,match[1].length+k)+"00"+tmp[j].substring(match[1].length+k+2);
            };
          }
        }
        let sliders = tmp.filter(cmd=>(new RegExp(`#${bar[1]}[34]${bar[2]}\\w:\\w?`,"gi").test(cmd)));
        let slidesum = "";
        let prefix = "";
        for (let slide of sliders) {
          if (!slidesum) { 
            prefix = /(#\d{3}[34]\w{2}:\s?)\w*/gi.exec(slide)[1]
            slidesum = /#\d{3}[34]\w{2}:\s?(\w*)/gi.exec(slide)[1];
            continue;
          }
          let content = /#\d{3}[34]\w{2}:\s?(\w*)/gi.exec(slide)[1]
          if (slidesum.length>content.length) {
            let ratio = slidesum.length/content.length;
            let expand = "";
            for (let k = 0; k < content.length; k+=2) {
              expand+=content[k]+content[k+1]+"0".repeat(ratio*2-2)
            }
            content=expand;
          } else {
            let ratio = content.length/slidesum.length;
            let expand = "";
            for (let k = 0; k < slidesum.length; k+=2) {
              expand+=slidesum[k]+slidesum[k+1]+"0".repeat((ratio*2-2)>0?(ratio*2-2):0)
            }
            slidesum=expand;
          }
          for (let k = 0; k < slidesum.length; k+=2) {
            if (slidesum[k]=="0") {
              slidesum = slidesum.substring(0,k)+content.substring(k,k+2)+slidesum.substring(k+2);
            }
          }
        }
        let ratio = slidesum.length/bar[3].length;
        tmp3 = tmp3.filter(note=>{
          if ((note*ratio)%2) {
            // No slide start/step/end exist for that air down
            // Shdn't ever happen???
            return false;
          }
          return !(new RegExp(`#\\d{3}[34]\\w{2}:\\s?(\\w{${parseInt(note*ratio/2)*2}})1${bar[7]}(\\w*)?`,"gi")).test(prefix+slidesum);
        })
        j = [];
        tmp.filter((cmd,i)=>{
          if (cmd.startsWith(`#${bar[1]}1${bar[2]}:`)) j.push(i);
          return cmd.startsWith(`#${bar[1]}1${bar[2]}:`)
        });
        if (j.length) {
          for (let k of j) {
            let len = /#\d{3}1\w:\s?(\w*)/gi.exec(tmp[k])[1].length;
            let ratio = len/(bar[3].length);
            for (let note of tmp3) {
              let match = (new RegExp(`(#\\d{3}1\\w:\\s?\\w{${parseInt(note*ratio/2)*2}})\\d[^0]((\\w*)?)`,"gi")).exec(tmp[k]);
              if (match) { tmp[k] = match[1]+"00"+match[2]; }
            }
          }
        }
      };
      
      // Find air ups
      tmp2 = [];
      tmp.forEach(cmd=>{
        let match = [...cmd.matchAll(/#(\d{3})5(\w):\s?(((?:(?:\w\w)*)?)[134](?=[^0])\w(?:\w*)?)/gi)];
        if (match.length) {
          tmp2.push(...match);
        }
      });
      // Remove taps associated with air ups at the end of slides
      for (let bar of tmp2) {
        let tmp3=[];
        let j = tmp.findIndex(cmd=>cmd.startsWith(bar[0]));
        if (j!=-1) {
          for (let k = 0; k < bar[3].length; k+=2) {
            if (["1","3","4"].includes(bar[3][k])) tmp3.push(k);
          }
        }
        let sliders = tmp.filter(cmd=>(new RegExp(`#${bar[1]}[34]${bar[2]}\\w:\\w?`,"gi").test(cmd)));
        let slidesum = "";
        let prefix = "";
        for (let slide of sliders) {
          if (!slidesum) { 
            prefix = /(#\d{3}[34]\w{2}:\s?)\w*/gi.exec(slide)[1]
            slidesum = /#\d{3}[34]\w{2}:\s?(\w*)/gi.exec(slide)[1];
            continue;
          }
          let content = /#\d{3}[34]\w{2}:\s?(\w*)/gi.exec(slide)[1]
          if (slidesum.length>content.length) {
            let ratio = slidesum.length/content.length;
            let expand = "";
            for (let k = 0; k < content.length; k+=2) {
              expand+=content[k]+content[k+1]+"0".repeat(ratio*2-2)
            }
            content=expand;
          } else {
            let ratio = content.length/slidesum.length;
            let expand = "";
            for (let k = 0; k < slidesum.length; k+=2) {
              expand+=slidesum[k]+slidesum[k+1]+"0".repeat((ratio*2-2)>0?(ratio*2-2):0)
            }
            slidesum=expand;
          }
          for (let k = 0; k < slidesum.length; k+=2) {
            if (slidesum[k]=="0") {
              slidesum = slidesum.substring(0,k)+content.substring(k,k+2)+slidesum.substring(k+2);
            }
          }
        }
        let ratio = slidesum.length/bar[3].length;
        tmp3 = tmp3.filter(note=>{
          if ((note*ratio)%2) {
            // Slide step does not exist for that air up
            // It's just a plain Pjsk flick
            return false;
          }
          return (new RegExp(`#\\d{3}[34]\\w{2}:\\s?(\\w{${parseInt(note*ratio/2)*2}})[^0]${bar[7]}(\\w*)?`,"gi")).test(prefix+slidesum);
        })
        
        j = tmp.findIndex(cmd=>cmd.startsWith(`#${bar[1]}1${bar[2]}:`));
        if (j!=-1) {
          let len = /#\d{3}1\w:\s?(\w*)/gi.exec(tmp[j])[1].length;
          let ratio = len/(bar[3].length);
          for (let note of tmp3) {
            let match = (new RegExp(`(#\\d{3}1\\w:\\s?\\w{${parseInt(note*ratio/2)*2}})\\d[^0]((\\w*)?)`,"gi")).exec(tmp[j]);
            if (match) { tmp[j] = match[1]+"00"+match[2]; }
          }
        }
      };
      
      // Remove flick and slide steps underneath
      tmp2=[];
      tmp.forEach(cmd=>{
        let match = [...cmd.matchAll(/#(\d{3})1(\w):\s?((\w*)3(((?=[^0])\w)\w*)?)/gi)];
        if (match.length) {
          tmp2.push(...match);
        }
      });
      for (let bar of tmp2) {
        let tmp3=[];
        let j = tmp.findIndex(cmd=>cmd.startsWith(bar[0]));
        if (j!=-1) {
          let match = /(#\d{3}1\w:\s?)(((?:(?:\w\w)*)?)3(?=[^0])\w((?:(?:\w\w)*)?))/gi.exec(tmp[j]);
          while (match&&!(match[3].length%2)) {
            tmp[j] = match[1]+match[3]+"00"+match[4];
            tmp3.push(match[3].length/match[2].length);
            match = /(#\d{3}1\w:\s?)(((?:(?:\w\w)*)?)3(?=[^0])\w((?:(?:\w\w)*)?))/gi.exec(tmp[j]);
          }
        }
        let sliders = tmp.filter(cmd=>(new RegExp(`#${bar[1]}[34]${bar[2]}\\w:\\s?`,"gi")).test(cmd));
        for (let slide of sliders) {
          let k = tmp.indexOf(slide);
          let len = /#\d{3}[34]\w\w:\s?(\w*)/gi.exec(tmp[k])[1].length;
          for (let note of tmp3) {
            if ((note*len)%2) {
              // Slide step does not exist for that flick
              // Shdn't ever happen?
              continue;
            }
            let match = (new RegExp(`(#\\d{3}[34]\\w\\w:\\s?\\w{${parseInt(note*len/2)*2}})[35][^0]((?:\\w*)?)`,"gi")).exec(tmp[k]);
            if (match) { tmp[k] = match[1]+"00"+match[2]; }
          }
        }
      };
      
      tmp.splice(1,0,info);
      return tmp;
    }
    return sus;
  }
  
  saveCustomChart(sus, filename) {
    let blob = new Blob([sus], {type: "application/octet-stream"});
    saveAs(blob, `${filename}.sus`);
  }
  
  selectAll() {
    document.querySelectorAll(`input[type="checkbox"]`).forEach(el=>el.checked=true);
    delete this.zip;
    document.getElementById('download').innerText="Patch and download selected";
  }
  
  unselectAll() {
    document.querySelectorAll(`input[type="checkbox"]`).forEach(el=>el.checked=false);
    delete this.zip;
    document.getElementById('download').innerText="Patch and download selected";
  }
  
  saveContent() {
    document.querySelectorAll(`input[type="checkbox"], input[type="radio"], button.select`).forEach(el=>el.disabled=true);
    this.dispatchEvent(new Event("zipstart"));
    let e = document.getElementById("Easy").checked;
    let n = document.getElementById("Normal").checked;
    let h = document.getElementById("Hard").checked;
    let ex = document.getElementById("Expert").checked;
    let ma = document.getElementById("Master").checked;
    let ap = document.getElementById("Append").checked;
    let c = document.getElementById("Jacket").checked;
    let audtype = Array.from(this.audtype).filter(el=>el.checked==true);
    let t = audtype[0].getAttribute("value");
    let tmp=[];
    let v = [];
    document.querySelectorAll(`input.vocal[type="checkbox"]`).forEach(vocal=>{
      if (vocal.checked) {
        let voc = vocal.getAttribute("name");
        v.push(voc);
        tmp.push(new Promise((resolve=>this.vocals[voc].trim.encode(t,resolve)).bind(this)));
      }
    })
    Promise.all(tmp).then((()=>this.saveZip({easy:e,normal:n,hard:h,expert:ex,master:ma,append:ap,jacket:c,vocals:v,type:t})).bind(this))
  }
  
  saveZip(options) {
    if (this.difficulties.every(d=>!options[d])&&!options.jacket&&!options.vocals.length) {
      document.querySelectorAll(`input[type="checkbox"], button.select`).forEach(el=>el.disabled=false);
      return;
    };
    if (this.zip) {
      document.querySelectorAll(`input[type="checkbox"], button.select`).forEach(el=>el.disabled=false);
      return saveAs(this.zip, `${this.song.title}.zip`);
    };
    this.patchSus();
    let zip = new JSZip();
    for (let level of this.difficulties) {
      if (options[level]) {
        zip.file(`${this.song.title} ${level}.sus`,this.charts[level].sus);
      }
    }
    if (options.jacket) {
      zip.file(`${this.song.raw.assetbundleName}.png`,this.song.jacket.file);
    }
    for (let vocal of options.vocals) {
      zip.file(`${vocal}.${options.type}`,this.vocals[vocal].trim[options.type]);
    }
    let save = content => {
      this.zip = content;
      this.dispatchEvent(new Event("zipend"));
      saveAs(content, `${this.song.title}.zip`);
    };
    zip.generateAsync({type:"blob"}).then(save.bind(this));
  }
}
