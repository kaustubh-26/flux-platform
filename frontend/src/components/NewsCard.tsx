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
        <div className="flex-1 flex items-center justify-center text-slate-400">
          Loading news…
        </div>
      ) : (
        <div
          className="
            flex-1
            h-full
            grid gap-1
            grid-cols-1
            sm:grid-cols-2
            lg:grid-cols-5
            auto-rows-fr
          "
        >
          {news
            .filter(
              (a) =>
                typeof a.description === 'string' &&
                a.description.trim().length > 0
            )
            .slice(0, 5)
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
      className="
        h-full
        bg-slate-900
        border border-slate-700
        rounded-md
        p-3
        flex flex-col
        hover:bg-slate-700
        transition
      "
    >
      {/* Title */}
      <h2 className="text-sm font-semibold line-clamp-3 pb-2">
        {article.title}
      </h2>

      {/* Description */}
      {article.description && (
        <p className="text-xs text-slate-300 line-clamp-5">
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

