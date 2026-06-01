require('dotenv').config();

const { GoogleGenerativeAI }
= require("@google/generative-ai");

const genAI =
new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);

async function test(){

const model =
genAI.getGenerativeModel({
model:"gemini-2.5-flash"
});

const result =
await model.generateContent(
"Extract machine,item,quantity from: Need 10 steel rods for drilling"
);

console.log(
result.response.text()
);

}

test();