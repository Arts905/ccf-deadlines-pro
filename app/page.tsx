import ConferenceList from './components/ConferenceList';
import ChatWidget from './components/ChatWidget';
import { Conference } from './types';
import fs from 'fs';
import path from 'path';
import LanguageSwitcher from './components/LanguageSwitcher';

async function getConferences() {
  const filePath = path.join(process.cwd(), 'public', 'conferences.json');
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents) as Conference[];
  } catch (error) {
    console.error('Error reading conferences file:', error);
    return [];
  }
}

export default async function Home() {
  const conferences = await getConferences();

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
             <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
               CCF Deadlines Pro
             </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 hidden md:block">
               Tracking {conferences.length} conferences
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="py-8">
        <ConferenceList conferences={conferences} />
      </div>

      <footer className="bg-white border-t border-gray-200 py-8 mt-12">    <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Data Source: <a href="https://github.com/ccfddl/ccf-deadlines" className="text-blue-600 hover:underline">ccfddl/ccf-deadlines</a></p>
          <p className="mt-2">Built with Next.js & Tailwind CSS</p>
        </div>
      </footer>
    </main>
  );
}
