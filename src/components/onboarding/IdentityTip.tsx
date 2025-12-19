'use client';

export function IdentityTip() {
  return (
    <div className="px-6 py-2">
      <div className="space-y-3">
        <h3 className="font-albert font-medium text-[24px] text-text-secondary tracking-[-1.5px] leading-[1.3]">
          Tip:
        </h3>
        
        <div className="font-sans text-[14px] text-text-secondary leading-[1.4] space-y-4">
          <p className="mb-0">
            Your mission is not your job title. It's your essence. What are you sent to do on this planet in this phase of your life?
          </p>
          
          <div>
            <p className="mb-2">Try one of the following templates:</p>
            <ul className="list-disc ml-5 space-y-1 marker:text-text-secondary">
              <li>I am someone who ___ so that ___.</li>
              <li>I am becoming a person who ___.</li>
              <li>I am the kind of person who brings ___ into the world.</li>
              <li>I am here to ___ through ___.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
