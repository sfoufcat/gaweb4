'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useDiscover } from '@/hooks/useDiscover';
import { BackButton, CourseCard, CategoryPills, SectionHeader } from '@/components/discover';

export default function CategoryDetailPage() {
  const params = useParams();
  const categoryId = params.id as string;
  
  const { categories, courses, articles, loading } = useDiscover();
  
  // Find the current category
  const category = categories.find(c => c.id === categoryId);
  
  // Filter content by category name
  const categoryCourses = courses.filter(c => c.category === category?.name);
  const categoryArticles = articles.filter(a => a.category === category?.name);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }
  
  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-albert font-medium text-2xl text-text-primary">Category not found</h1>
        <Link 
          href="/discover"
          className="text-earth-500 hover:text-earth-600 transition-colors"
        >
          ← Back to Learn
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="font-albert font-normal text-3xl text-text-primary tracking-[-1.5px] leading-[1.2]">
            {category.name}
          </h1>
        </div>
        
        {/* Category Pills for navigation */}
        <CategoryPills categories={categories} selectedCategory={categoryId} />
      </section>

      {/* Courses Section */}
      {categoryCourses.length > 0 && (
        <section className="px-4 py-5">
          <div className="flex flex-col gap-4">
            <SectionHeader title="Courses" />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categoryCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Articles Section */}
      {categoryArticles.length > 0 && (
        <section className="px-4 py-5">
          <div className="flex flex-col gap-4">
            <SectionHeader title="Articles" />
            
            <div className="flex flex-col gap-3">
              {categoryArticles.map((article) => (
                <Link 
                  key={article.id}
                  href={`/discover/articles/${article.id}`}
                  className="block"
                >
                  <div className="bg-white/70 rounded-[20px] p-4 hover:shadow-md transition-shadow">
                    <div className="flex gap-4">
                      {/* Cover Image */}
                      {article.coverImageUrl && (
                        <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-earth-100">
                          <Image 
                            src={article.coverImageUrl} 
                            alt={article.title}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-albert font-semibold text-lg text-text-primary tracking-[-0.5px] leading-[1.3] line-clamp-2 mb-1">
                          {article.title}
                        </h3>
                        <p className="font-sans text-sm text-text-muted">
                          {article.authorName}
                          {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min read`}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {categoryCourses.length === 0 && categoryArticles.length === 0 && (
        <section className="px-4 py-12">
          <div className="text-center">
            <p className="text-text-muted font-sans">
              No content available in this category yet.
            </p>
            <Link 
              href="/discover"
              className="inline-block mt-4 text-earth-500 hover:text-earth-600 transition-colors"
            >
              ← Browse all content
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
