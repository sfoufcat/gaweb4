'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        {/* 404 Number */}
        <h1 className="text-8xl md:text-9xl font-albert font-bold text-[#1a1a1a] tracking-tight">
          404
        </h1>
        
        {/* Divider */}
        <div className="w-16 h-0.5 bg-[#a07855]/30 mx-auto my-6" />
        
        {/* Message */}
        <p className="text-lg md:text-xl text-[#5f5a55] font-albert mb-8">
          This page could not be found.
        </p>
        
        {/* Back Home Button */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-2xl font-albert font-medium text-sm hover:bg-[#2a2a2a] transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}












