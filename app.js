import { ScratchCloud } from "@errorgamer2000/scratch-cloud";
import fetch from "node-fetch";
import { promisify } from "util";
import dotenv from "dotenv";

dotenv.config();

const sleep = promisify(setTimeout);

// Get login info from .env file
const USERNAME = process.env.SCRATCH_USERNAME;
const PASSWORD = process.env.SCRATCH_PASSWORD;
const PROJECT_ID = process.env.PROJECT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TOTAL_CHUNKS = 8;
let sessionActive = false;
let lastQueueId = null;

// All the characters we can send (95 total)
const ALL_CHARS_STR = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ";
const ALL_CHARS = ALL_CHARS_STR.split('');

// Turn text into numbers (so Scratch cloud can handle it)
function encodeText(text, defaultChar = " ") {
    let number = "";
    text = String(text);

    for (let char of text) {
        let index = ALL_CHARS.indexOf(char);

        // If character not found, use space instead
        if (index === -1) {
            index = ALL_CHARS.indexOf(defaultChar);
        }
        
        // Convert to 1-95 range
        let indexString = String(index + 1);

        // Add leading zero if needed (01 to 09)
        if (indexString.length === 1) {
            indexString = '0' + indexString;
        }

        number += indexString;
    }
    
    // Replace 4049 with 00 (newline)
    return number.replaceAll("4049", "00");
}

// Turn numbers back into text
function decodeText(encodedCode) {
    encodedCode = String(encodedCode);
    let text = "";
    
    // Read two digits at a time
    for (let i = 0; i < encodedCode.length; i += 2) {
        const code = encodedCode.substring(i, i + 2);
        if (code.length < 2) continue;

        // Convert back to character
        const index_1_based = parseInt(code, 10);
        const index_0_based = index_1_based - 1;

        if (index_0_based >= 0 && index_0_based < ALL_CHARS.length) {
            text += ALL_CHARS[index_0_based];
        } else {
            console.warn(`Invalid code: ${code}`);
            text += "?";
        }
    }
    return text;
}

// Split long message into 8 chunks (Scratch cloud variable limit)
function splitNumericStringIntoChunks(encodedResponse) {
    const MAX = 256;
    const TOTAL_CHUNKS = 8;
    const chunks = [];

    // Calculate chunk size
    let chunkSize = Math.ceil(encodedResponse.length / TOTAL_CHUNKS);
    if (chunkSize > MAX) chunkSize = MAX;

    // Split the message
    for (let i = 0; i < TOTAL_CHUNKS; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const part = encodedResponse.substring(start, end);
        chunks.push(part);
    }

    // If message too long, cut it off and warn
    const maxAllowed = chunkSize * TOTAL_CHUNKS;
    if (encodedResponse.length > maxAllowed) {
        const warn = encodeText("nwSystem note: data over size limit, auto cutting.");
        chunks[TOTAL_CHUNKS - 1] = warn.substring(0, MAX);
    }

    return chunks;
}

// Ask AI for a response
async function generateResponse(prompt) {
  const apiKey = GEMINI_API_KEY || ""; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const systemPrompt = "You are a chatbot. Respond simply, briefly, and child-friendly. Use 'nw' for new lines. use nw to make newline 80 letters a line REMENBER TO USE NEWLINE(if its one line dont do it) , answer nicely and dont spam letters and heres user request: ";
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    systemInstruction: {
        parts: [{ text: systemPrompt }]
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}...`);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error("AI error:", err.message);
    return "Sorry, I couldn't generate a response.nwTry asking something simple. nw(server error)";
  }
}

async function main() {
  console.log("Server starting...");

  // Check if all login info exists
  if (!USERNAME || !PASSWORD || !PROJECT_ID || !GEMINI_API_KEY) {
    console.error("ERROR: Missing info in .env file!");
    console.error("Need: SCRATCH_USERNAME, SCRATCH_PASSWORD, PROJECT_ID, GEMINI_API_KEY");
    return;
  }

  // Login to Scratch
  const scratch = new ScratchCloud();
  try {
    console.log("Logging in...");
    await scratch.login(USERNAME, PASSWORD);
    console.log("Logged in!");
  } catch (err) {
    console.error("Login failed:", err.message);
    return;
  }

  // Connect to cloud variables
  let session;
  try {
    console.log(`Connecting to project ${PROJECT_ID}...`);
    session = scratch.createSession(PROJECT_ID, false);
  } catch (err) {
    console.error("Connection failed:", err.message);
    return;
  }

  // Handle errors
  session.on('error', (err) => {
    console.error("Connection error:", err.message);
    sessionActive = false;
  });

  // Handle successful connection
  session.on('open', () => {
    console.log("Connected!");
    sessionActive = true;
  });

  // Wait for connection
  await sleep(5000); 

  if (!sessionActive) {
      console.log(`Connection failed. Check if project ${PROJECT_ID} is shared.`);
      return;
  }

  // Main loop - check for requests every 10 seconds
  while (true) {
    try {
      // Check if still connected cuz scratch kept messing with me
      if (!sessionActive) {
          console.log("Not connected. Waiting...");
          await sleep(10000);
          continue;
      }
      
      // Check if there's a new request
      const queueResult = session.get("Public.QueueIDc");
      const nowQueue = queueResult || "0";

      // If new request (not 0 or 0721, and different from last)
      if (nowQueue !== lastQueueId && nowQueue !== "0" && nowQueue !== "0721") {
        console.log("New request:", nowQueue);
        lastQueueId = nowQueue;

        // Get the encoded question
        const encodedPrompt = session.get("Public.Requestidkc");
        
        console.log("Encoded question:", encodedPrompt);
        if (!encodedPrompt || encodedPrompt === "0") {
          console.log("Empty request, skipping");
          await sleep(10000);
          continue;
        }

        // Decode the question
        const prompt = decodeText(encodedPrompt);
        console.log("Question:", prompt);

        // Tell Scratch we got the request
        session.set("Public.Requestidkc", "0721");
        console.log(`Processing request ${nowQueue}`);
        
        // Get AI answer
        const aiResponse = await generateResponse(prompt);
        console.log("Answer:", aiResponse);

        // Encode the answer
        const encodedAiResponse = encodeText(aiResponse);

        // Split into chunks
        const chunks = splitNumericStringIntoChunks(encodedAiResponse);
        console.log(`Split into ${chunks.length} chunks`);

        // Send chunks to Scratch (backwards, chunk 8 to 1) so it checks the 1
        for (let i = TOTAL_CHUNKS - 1; i >= 0; i--) {
            const varName = `Public.Respond.Chunk${i + 1}c`;
            const chunkData = chunks[i] || "0";

            try {
                session.set(varName, chunkData);
                console.log(`Sent ${varName} (${chunkData.length} digits)`);
            } catch (err) {
                console.warn(`Failed to send ${varName}: ${err.message}`);
            }

            await sleep(300);
        }
        
        console.log(`Done with request ${nowQueue}!`);
      }

      // Wait 10 seconds before checking again
      await sleep(10000);

    } catch (err) {
      console.error("Error:", err.message);
      await sleep(5000);
    }
  }
}

main();
