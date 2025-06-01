# 3D Clothing Design Automation

A Next.js application that automates the process of generating Midjourney prompts for 3D clothing design using ChatGPT and Pinterest images.

## Features

- 📸 **Bulk Image Upload**: Upload unlimited Pinterest fashion images at once
- 🤖 **AI-Powered Prompt Generation**: ChatGPT analyzes images and generates detailed Midjourney prompts
- 🎯 **Clothing Part Selection**: Specify which part of the outfit to focus on (top, bottom, dress, etc.)
- 📊 **Progress Tracking**: Real-time progress monitoring for batch processing
- 💾 **Export Results**: Download all generated prompts as text files
- 🔄 **Batch Processing**: Automatically generates 15 unique Midjourney prompts per image

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   cd clothing-design-automation
   npm install
   ./setup-hooks.sh  # Install git hooks for auto-versioning
   ```

2. **Set up environment variables:**
   ```bash
   # Copy .env.local and add your OpenAI API key
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## How It Works

### Process Overview

1. **Upload Images**: Drag and drop up to 30 Pinterest fashion images
2. **Select Clothing Parts**: Choose which part of each outfit to focus on
3. **AI Processing**: ChatGPT analyzes each image and generates 15 detailed Midjourney prompts
4. **Download Results**: Export all prompts as text files for use in Midjourney

### Example Output

For each uploaded image, you'll get 15 unique prompts like:

```
runway fashion look, vintage graphic ringer t-shirt tucked into a high-waisted metallic blue mini skirt, wide hot pink belt with black studs and silver buckle, fishnet tights, silver futuristic high-heeled boots, bold 80s glam makeup, voluminous hair, confident walk, fashion week runway background --v 6 --style raw --ar 2:3
```

## API Endpoints

- **POST `/api/upload`**: Handles image uploads and processing
- **POST `/api/generate-prompt`**: Generates prompts for individual images
- **POST `/api/process-batch`**: Processes multiple images in batches

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: OpenAI GPT-4 Vision API
- **Image Processing**: Sharp
- **File Upload**: react-dropzone
- **Icons**: Lucide React

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### Supported File Types

- PNG, JPG, JPEG, WebP
- No file size limits
- No file count limits

## Usage Tips

1. **Image Quality**: Use high-quality Pinterest images for better prompt generation
2. **Clothing Parts**: Be specific about which part of the outfit you want to focus on
3. **Batch Processing**: The system processes 5 images at a time to respect API rate limits
4. **Results**: Each image generates exactly 3 unique Midjourney prompts optimized for 3D design

## Architecture

```
src/
├── app/
│   ├── api/           # API routes
│   └── page.tsx       # Main application
├── components/        # React components
├── lib/              # Utilities and OpenAI integration
└── types/            # TypeScript type definitions
```

## Deployment

The application is ready for deployment on Vercel, Netlify, or any platform supporting Next.js.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Auto-Versioning

The application includes automatic version management:

- **Version Display**: Current version and build date shown in the app header
- **Auto-Increment**: Version automatically increments on every `git push`
- **Git Hooks**: Pre-push hook handles version bumping and commits

To set up auto-versioning:
```bash
./setup-hooks.sh
```

## License

MIT License - see LICENSE file for details.
