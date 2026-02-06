# Student App

## AI Setup

### Gemini AI
To enable Gemini AI features, you need to provide Google Gemini API Keys.

**Method 1: Admin Dashboard (Recommended for Rotation)**
1. Log in as Admin.
2. Go to **Config** -> **Security**.
3. Under "Gemini API Keys", paste your keys one by one.
4. Get keys from [Google AI Studio](https://aistudio.google.com/app/apikey).

**Method 2: Environment Variables (Server-side Fallback)**
Set the following environment variable in Vercel:
`GEMINI_API_KEYS="key1,key2,key3"`
(Comma-separated list of keys).

### Groq AI
Similar to Gemini, set keys in the Admin Dashboard or use `GROQ_API_KEYS` in Vercel.
