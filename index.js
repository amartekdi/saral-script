const testFolder = "./images/";
const imageFile = "image-url.json";
const keyFile = "key.txt"
const fs = require("fs");
let api_key = "";
const reqUrl = "https://vision.googleapis.com/v1/images:annotate?alt=json&key=";
const axios = require("axios");
let imagesUrls = [];
const util = {
  getSortedCordinates:(arr)=>{
    return arr.sort((a,b)=>{return a.y - b.y})
  },
  getSubString: (iInput, from, to) => {
    try {
      return iInput.split(from)[1].split(to)[0].trim();
    } catch (error) {
      console.log("Error code 101");
      return " ";
    }
  },
  requestObj : {
    features: [
      {
        maxResults: 50,
        type: "LANDMARK_DETECTION",
      },
      {
        maxResults: 50,
        type: "FACE_DETECTION",
      },
      {
        maxResults: 50,
        model: "builtin/latest",
        type: "OBJECT_LOCALIZATION",
      },
      {
        maxResults: 50,
        model: "builtin/latest",
        type: "LOGO_DETECTION",
      },
      {
        maxResults: 50,
        type: "LABEL_DETECTION",
      },
      {
        maxResults: 50,
        model: "builtin/latest",
        type: "DOCUMENT_TEXT_DETECTION",
      },
      {
        maxResults: 50,
        type: "SAFE_SEARCH_DETECTION",
      },
      {
        maxResults: 50,
        type: "IMAGE_PROPERTIES",
      },
      {
        maxResults: 50,
        type: "CROP_HINTS",
      },
    ],
    imageContext: {
      cropHintsParams: {
        aspectRatios: [0.8, 1, 1.2],
      },
    },
  }
};

fs.readFile(keyFile, "utf8", function (err, data) {api_key=data});

const prepareRequest = () => {
    fs.readFile(imageFile, "utf8", function (err, data) {
      if (err) throw err;
      imagesUrls = JSON.parse(data);
      console.log("Total Images : ", imagesUrls.length);
      let promises = [];
      while (imagesUrls.length) {
        let arr = [];
        let iArr = imagesUrls.splice(0, 15);
        for (let i = 0; i < iArr.length; i++) {
          arr.push({...(util.requestObj), image: { source: { imageUri: iArr[i] } }});
        }
        promises.push(sendRequst(arr));
      }
      Promise.all(promises).then(async (responses) => {
        let res = responses.flat(1);
        console.log("Records received  : ", res.length);
        console.timeEnd("Duration");
        saveDataAs("FinalData_", res);
      });
    });
};

const sendRequst = (reqBody) => {
  console.log("request sent"); 
  return axios
    .post(reqUrl+api_key, {
      requests: Array.from(reqBody),
    })
    .then(function (response) {
      return prepareData(response.data.responses);
    })
    .catch(function (error) {
      console.log("---------->", error);
    });
};

const prepareData = (data) => {
  console.log("preparing data ...");
  let newData = data
    .map((response) => {
      try {
        if (response?.fullTextAnnotation?.pages[0]?.blocks.length){
          return getArrengedBlocks(response.fullTextAnnotation.pages[0].blocks);
        }else console.log("Plese check response .....",response);
        return [];
      } catch (error) {
        console.log(error);
      }
    })
    .filter(function (el) {
      return el != null;
    });
  return getFinalData(newData);
};

const getArrengedBlocks = (dataArr)=>{
  // console.log("preparing blocks ...");
  let blocks = dataArr.map((data)=>{
    let text = data.paragraphs[0].words.map((word)=>{
      return word.symbols.map((symbol)=>{return symbol?.property?.detectedBreak?.type=="SPACE"? symbol.text+" ": symbol.text}).join("")
    }).join(" ")
      return {...data.paragraphs[0],words:text};
   });
  let arr = [];
  while(blocks.length){
    const min = util.getSortedCordinates(blocks[0].boundingBox.vertices)[0].y - 50;
    const max = util.getSortedCordinates(blocks[0].boundingBox.vertices)[3].y - 10;
    const match = blocks.filter((block)=>{
      return util.getSortedCordinates(block.boundingBox.vertices)[0].y >= min &&  util.getSortedCordinates(block.boundingBox.vertices)[0].y <= max;
    }).sort((a,b)=>{
        return a.boundingBox.vertices[0].x - b.boundingBox.vertices[0].x;
    });
    arr.push(match);
    blocks = Array.from(blocks.filter((block)=>{
      return !(util.getSortedCordinates(block.boundingBox.vertices)[0].y >= min &&  util.getSortedCordinates(block.boundingBox.vertices)[0].y <= max);
  }));
  if(match.length==0){
    console.log("Matching blockes not found")
    break
  };
  }
return arr;
}

const getFinalData = (newData)=>{
  console.log("preparing final data ...")
  return newData.map((iData,index) => {
    let response = {id:index+1};
    try {
      let rowArr = iData.map((rows)=>{
        return rows.map((row)=>{ return row.words; }).join(" ");
      });
      let dataString = rowArr.filter((row)=>{return row.includes("Name")})[0];
      response.name = util.getSubString(dataString,":","Class");
      response.class = util.getSubString(dataString,"Class :","Date :");
      response.date = util.getSubString(dataString,"Date :",".");
      dataString = rowArr.filter((row)=>{return row.includes("School")})[0];
      response.school = util.getSubString(dataString,"School :","Start");
      response.startTime = util.getSubString(dataString,"time :","End");
      response.endTime = util.getSubString(dataString,"Time :",".");
      let iIndex = rowArr.findIndex(element => element.includes("Final"));
      response.answers = [];
      for (let index = iIndex + 1; index < iData.length - 1 ; index++) {
        if(!(JSON.stringify(iData[index])).includes(")"))break;
        let ansArr = [];
        for (let i = 0; i < iData[index].length; i++) {
            let question = 0;
            let answer = "";let confidence = 0;
            let arr = iData[index][i].words.split(")");
            if(arr[1]&&(arr[1].trim()).length){
                question = parseInt(arr[0].replace(/\D/g,''));
                answer = arr[1].trim();
                confidence = iData[index][i].confidence;
            }else{
              question = parseInt(iData[index][i].words.replace(/\D/g,''));
              if(iData[index][i+1] && !iData[index][i+1].words.includes(")")){
                  answer = iData[index][i+1].words;
                  confidence = iData[index][i+1].confidence;
                  i++;
              }
            }
            
            ansArr.push({question,answer,confidence});
        }
        response.answers.push(...ansArr);
      }
    } catch (error) {
      console.log("Error code 102",error);
    }
    return response;
  });
}

const saveDataAs = (name, data) => {
  fs.writeFile(
    testFolder+ name + new Date().toISOString() + "_Data.json",
    JSON.stringify(data),
    "utf8",
    () => {
      console.log("File saved successfully.");
    }
  );
};
console.time("Duration");
prepareRequest();
