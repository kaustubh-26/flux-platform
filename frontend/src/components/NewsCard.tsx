import { useState } from 'react';
import { useTopNews } from '@/hooks/useTopNews';

type NewsScope = 'local' | 'global';

function NewsCard() {
  const [scope, setScope] = useState<NewsScope>('global');
  const news = useTopNews();

  return (
    <div className="h-full bg-slate-800 rounded-lg shadow-md flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-md border border-slate-700">
          <Tab
            active={scope === 'global'}
            onClick={() => setScope('global')}
            label="Global News"
          />
        </div>
      </div>

      {/* Content */}
      {!news ? (
        <div
          className="flex-1 flex flex-col gap-2 max-h-[50vh] overflow-y-auto
          sm:flex-row sm:overflow-x-auto sm:overflow-y-hidden sm:pb-2"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-full sm:min-w-[290px] sm:max-w-[290px] bg-slate-900 border border-slate-700 rounded-md p-3 flex flex-col"
            >
              {/* Title */}
              <div className="space-y-2 mb-4">
                <div className="h-4 w-full bg-slate-700/60 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-slate-700/50 rounded animate-pulse" />
              </div>

              {/* Description */}
              <div className="space-y-2 mb-4">
                <div className="h-3 w-full bg-slate-700/40 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-slate-700/30 rounded animate-pulse" />
              </div>

              {/* Footer */}
              <div className="mt-auto pt-2 flex justify-between">
                <div className="h-3 w-20 bg-slate-700/40 rounded animate-pulse" />
                <div className="h-3 w-12 bg-slate-700/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex-1 thin-scrollbar
              /* Mobile */
              flex flex-col gap-2
              max-h-[60vh] overflow-y-auto
              /* Desktop */
              sm:max-h-none
              sm:flex-row
              sm:overflow-x-auto sm:overflow-y-hidden
              sm:pb-2
              sm:scroll-smooth"
        >
          {news
            .filter(
              (a) =>
                typeof a.description === 'string' &&
                a.description.trim().length > 0
            )
            // .slice(0, 5)
            .map((article) => (
              <NewsItem key={article.id} article={article} />
            ))}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 text-xs font-medium rounded
        transition
        ${active
          ? 'bg-slate-700 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'}
      `}
    >
      {label}
    </button>
  );
}

function NewsItem({ article }: { article: any }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 hover:bg-slate-700
      sm:min-w-[290px]
      sm:max-w-[290px]
      flex flex-col
      transition"
    >
      {/* Title */}
      <h2 className="text-sm font-semibold line-clamp-2 pb-5">
        {article.title}
      </h2>

      {/* Description */}
      {article.description && (
        <p className="text-xs text-slate-300 line-clamp-2">
          {article.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-2 text-xs text-slate-400 flex justify-between">
        <span className="truncate max-w-[60%]">
          {article.source}
        </span>
        <span>
          {new Date(article.publishedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    </a>
  );
}



export default NewsCard;

