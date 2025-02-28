import './App.css';
import WeatherCard from './components/WeatherCard';
import NewsCard from './components/NewsCard';
import StockCard from './components/StockCard';
import CryptoCard from './components/CryptoCard';

function App() {

  return (
    <>
      <div className="min-h-screen min-w-screen bg-neutral-800 text-slate-100">
        <header className="w-screen [10vh] px-6 mb-1 inline-flex">
          <div className='w-[90vw]'>
            <div className="text-3xl font-bold">Real-time Dashboard</div>
            <p className="text-slate-400 text-[12px]">Weather · News · Stocks · Crypto</p>
          </div>
          <div className='w-[10vw]'>
            <div className="md:text-xl text-sm float-end pt-1">Hi, User</div>
          </div>
        </header>

        <div className="max-w-screen mx-auto">
          <div className='w-screen h-[15vh] mb-2'>
            <WeatherCard />
          </div>
          <div className='w-screen h-[25vh] mb-2'>
            <NewsCard />
          </div>
          <div className='h-[50vh] grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-2'>
            <StockCard />
            <CryptoCard />
          </div>
        </div>
      </div>
    </>
  )
}

export default App
