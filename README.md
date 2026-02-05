# CCF Deadlines Pro 🚀

A modern, real-time tracking tool for CCF (China Computer Federation) recommended conferences, supercharged with an AI Assistant.

[简体中文](./README_CN.md) | [English](./README.md)

![Project Preview](https://github.com/Arts905/ccf-deadlines-pro/raw/main/public/preview.png)
*(Note: You might want to add a screenshot here later)*

## ✨ Key Features

- **🤖 AI Research Assistant**: Integrated with **DeepSeek API**, offering real-time Q&A about conference deadlines, recommendations, and status. It perceives current server time to provide accurate "Expired/Active" status.
- **⏱️ Real-time Countdowns**: Precise countdowns to submission deadlines, automatically adjusting for different timezones (UTC/AoE/Local).
- **🔍 Smart Filtering**: 
  - Filter by CCF Rank (A/B/C/Non-CCF).
  - Filter by Category (AI, Systems, Theory, etc.).
  - Instant Search by name or description.
- **🌐 Multi-language Support**: Seamless switching between English and Chinese.
- **⚡ Hot Updates**: Data updates via `conferences.json` are reflected instantly without server restarts (using file watchers and caching strategies).
- **📱 Responsive Design**: Built with Tailwind CSS for perfect rendering on mobile and desktop.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Integration**: [DeepSeek API](https://www.deepseek.com/)
- **Deployment**: [Vercel](https://vercel.com/)
- **State Management**: React Hooks (useState, useEffect)
- **Time Handling**: [Day.js](https://day.js.org/)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Arts905/ccf-deadlines-pro.git
   cd ccf-deadlines-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory and add your DeepSeek API key:
   ```env
   DEEPSEEK_API_KEY=sk-your-api-key-here
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 📂 Project Structure

```
├── app/
│   ├── api/            # API Routes (Chat, Translate)
│   ├── components/     # React Components (ConferenceList, ChatWidget)
│   ├── contexts/       # Global State (Language)
│   ├── globals.css     # Global Styles (Tailwind)
│   └── page.tsx        # Main Entry
├── public/
│   └── conferences.json # Data Source (JSON Database)
└── ...
```

## 🤝 Contributing

Contributions are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 👏 Credits

- Conference data source: [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines)

## 📄 License

Distributed under the MIT License.
