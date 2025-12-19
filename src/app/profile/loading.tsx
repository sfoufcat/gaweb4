export default function ProfileLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Simple centered spinner - matches app design */}
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    </div>
  );
}




