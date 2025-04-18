import { useEffect, useRef } from "react";
import CryptoCard from "../components/CryptoCard";
import Header from "../components/Header";
import NewsCard from "../components/NewsCard";
import StockCard from "../components/StockCard";
import WeatherCard from "../components/WeatherCard";
import { useSocket } from "../context/socketContext";
import { useLocation } from "../hooks/useLocation";
import { LocalStorage } from "../utils";
import debounce from 'lodash.debounce';


const DashboardPage = () => {

    const location = useLocation();
    const { socket, connected, setUserReady, userReady } = useSocket();
    const sendRef = useRef(
        debounce((socket: any, location: any, id: string) => {
            socket.emit('userLocationUpdate', location, id);
        }, 1000) // debounce location updates before emitting
    );

    useEffect(() => {
        // Check if socket is available
        if (!socket || !connected || !location) return;

        const storedId = LocalStorage.get('userid');

        if (storedId) {
            sendRef.current(socket, location, storedId);
            setUserReady(true);
        } else {
            socket.emit('getUserId');
        }

        const handler = (id: string) => {
            const currentId = LocalStorage.get('userid');
            if (!currentId) {
                LocalStorage.set('userid', id);
                sendRef.current(socket, location, id);
                setUserReady(true);
            }
        }

        socket.on('userUniqueId', handler);

        return () => {
            socket.off('userUniqueId', handler);
            sendRef.current.cancel(); // prevent debounced emits after unmount
        };
    }, [socket, connected, location]);

    if (!userReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-800">
                <div className="flex flex-col items-center gap-4">

                    {/* Animated rings */}
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-600 opacity-30 animate-ping" />
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-spin" />
                        <div className="absolute inset-3 rounded-full bg-emerald-500/20 backdrop-blur-sm" />
                    </div>

                    {/* Text */}
                    <div className="text-emerald-400 text-sm tracking-wide flex items-center gap-1">
                        Connecting to live data
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce delay-100">.</span>
                        <span className="animate-bounce delay-200">.</span>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen min-w-screen bg-neutral-800 text-slate-100">
            <Header />
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
    )
}

export default DashboardPage;