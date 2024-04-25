const testFolder = "./images/";
const imageFile = "image-url.json";
const fs = require("fs");
const api_key = "YOUR_API_KEY";
const reqUrl =
  "https://content-vision.googleapis.com/v1/images:annotate?alt=json&key=" +
  api_key;
const axios = require("axios");
console.time("Duration");
let imagesUrls = [];
// imagesUrls = Array.from({length: 100}, (_, i) => "https://saral-numeracy.s3.ap-south-1.amazonaws.com/tests/image"+(i+15)+".jpg");

const prepareRequest = (flag) => {
  // for local images , images should not be more than 20MB
  if (flag)
    fs.readdir(testFolder, (err, files) => {
      let arr = [];
      files.forEach((file) => {
        let bitmap = fs.readFileSync(testFolder + file);
        let reqObj = Object.assign(
          { features: [{ type: "TEXT_DETECTION" }], image: {} },
          { image: { content: Buffer.from(bitmap).toString("base64") } }
        );
        arr.push(reqObj);
      });
      sendRequst(arr);
    });

  // using image urls.
  if (!flag) {
    fs.readFile(imageFile, "utf8", function (err, data) {
      if (err) throw err;
      imagesUrls = JSON.parse(data);
      console.log("Total Images : ",imagesUrls.length);
      let promises = [];
      while (imagesUrls.length) {
        let arr = [];
        let iArr = imagesUrls.splice(0, 15);
        for (let i = 0; i < iArr.length; i++) {
          let reqObj = {
            features: [{ type: "TEXT_DETECTION" }],
            image: { source: { imageUri: iArr[i] } },
          };
          arr.push(reqObj);
        }
        promises.push(sendRequst(arr));
      }
      Promise.all(promises).then(async (responses) => {
        let res = responses.flat(1);
        //console.log("Total Records : ", imagesUrls.length);
        console.log("Records saved  : ", res.length);
        console.timeEnd("Duration");
        fs.writeFile(
          new Date().toISOString() + "_data.json",
          JSON.stringify(res),
          "utf8",
          () => {
            console.log("Response received and mapped successfully..");
          }
        );
      });
    });
  }
};

const sendRequst = (reqBody) => {
  console.log("request sent");
  return axios
    .post(reqUrl, {
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
  let newData = data
    .map((response) => {
      try {
        let newResponse = response.textAnnotations.sort(function (a, b) {
          return a.boundingPoly.vertices[0].y - b.boundingPoly.vertices[0].y;
        });
        if (newResponse.length)
          newResponse[0].property =
            response.fullTextAnnotation.pages[0].property;
        return newResponse;
      } catch (error) {
        console.log(response);
      }
    })
    .filter(function (el) {
      return el != null;
    });

  const finalData = newData.map((iData) => {
    let input = iData[0].description.replace(/\n/g, " ");
    const util = {
      getSubString: (iInput, from, to) => {
        try {
          return iInput.split(from)[1].split(to)[0].trim();
        } catch (error) {
          onsole.log("start : ", from);
          onsole.log("end : ", to);
          console.log("input : ", input);
          return " ";
        }
      },
      getAnswers: (answerString) => {
        let iAns = [];
        for (let index = 1; index < 13; index++) {
          let str = (answerString.split(index+")")[1].trim()).split(" ")[0];
          iAns.push(index+") "+(str.includes(")")?"":str));
        }
        return iAns;
      },
    };
    let response = Object.assign(
      {},
      { property: iData[0].property.detectedLanguages }
    );
    try {
      response.title = input.split("Name:")[0].trim();
      response.name = util.getSubString(input, "Name:", "School:");
      response.class = util.getSubString(input, "Class:", "Start time:");
      response.date = util.getSubString(input, "Date:", "End Time:");
      response.school = util.getSubString(input, "School:", "1)");
      response.startTime = util.getSubString(input, "Start time:", "Date:");
      response.endTime = util.getSubString(input, "End Time:", "3)");
      response.answers = util.getAnswers(util.getSubString(input, "Final Answers:", "Add"));
      response.sheetCode = "Add_" + util.getSubString(input, "Add_", "1/");
    } catch (error) {}
    return response;
  });
  return finalData;
};

prepareRequest();
