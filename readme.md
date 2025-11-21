# Scratch Cloud AI Chatbot Server

A Node.js server that connects Scratch projects to Google's Gemini AI through Scratch cloud variables.

## What This Does

This server acts as a bridge between Scratch and AI. It:
- Listens for questions from your Scratch project
- Sends them to Google's Gemini AI
- Returns the AI's response back to Scratch
- Handles encoding/decoding since Scratch cloud variables only support numbers

## Requirements

- Node.js (version 14 or higher)
- A Scratch account
- A Google Gemini API key
- A Scratch project with cloud variables set up

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the project root (see example below)

4. Run the server:
```bash
node index.js
```

## Environment Variables

Create a `.env` file in the project root with the following:

```env
SCRATCH_USERNAME=your_scratch_username
SCRATCH_PASSWORD=your_scratch_password
PROJECT_ID=your_project_id
GEMINI_API_KEY=your_gemini_api_key
```

### How to Get These Values

**SCRATCH_USERNAME and SCRATCH_PASSWORD**
- Your Scratch account credentials
- Make sure the account has access to the project

**PROJECT_ID**
- The number in your Scratch project URL
- Example: `https://scratch.mit.edu/projects/1113867787/` → Project ID is `1113867787`

**GEMINI_API_KEY**
- Get one from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Free tier available

## Required Scratch Cloud Variables

Your Scratch project needs these cloud variables:

- `Public.QueueIDc` - Request ID tracker
- `Public.Requestidkc` - Encoded question from Scratch
- `Public.Respond.Chunk1c` through `Public.Respond.Chunk8c` - Response chunks

## How It Works

1. Server connects to your Scratch project's cloud variables
2. Scratch sends an encoded question in `Public.Requestidkc`
3. Server decodes the question
4. Server asks Gemini AI for an answer
5. Server encodes the answer into numbers
6. Server splits the answer into 8 chunks (cloud variable size limit)
7. Server writes chunks back to Scratch cloud variables
8. Scratch reads and displays the answer

## Encoding System

Since Scratch cloud variables only support numbers, text is encoded:
- Each character maps to a 2-digit number (01-95)
- 95 characters supported (letters, numbers, basic punctuation)
- Special code `4049`(nw) compressed to `00` for newline

## Troubleshooting

**Server won't connect**
- Check if your Scratch project is shared
- Verify PROJECT_ID is correct
- Make sure cloud variables exist in your project

**Login failed**
- Double-check USERNAME and PASSWORD in .env
- Make sure the account owns or has access to the project

**No responses**
- Check GEMINI_API_KEY is valid
- Look at console logs for specific errors
- Verify Scratch is setting `Public.QueueIDc` correctly

## Security Notes

- Never commit your `.env` file to git
- Add `.env` to your `.gitignore`
- Keep your API keys private
- Consider using a dedicated Scratch account for the server

## Dependencies

- `@errorgamer2000/scratch-cloud` - Scratch cloud variable connection
- `node-fetch` - HTTP requests to Gemini API
- `dotenv` - Environment variable management

## License

MIT

## Support

If you encounter issues, check:
1. All environment variables are set correctly
2. Scratch project is shared and accessible
3. Cloud variables are named correctly
4. Console logs for specific error messages
