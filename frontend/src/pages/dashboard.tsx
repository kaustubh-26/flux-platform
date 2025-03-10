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
    const { socket } = useSocket();
    const sendRef = useRef(
        debounce((socket: any, location: any, id: string) => {
            socket.emit('userLocationUpdate', location, id);
        }, 2000) // adjust debounce interval as needed
    );

    useEffect(() => {
        // Check if socket is available, if not, show an alert
        if (!socket) return;

        const storedId = LocalStorage.get('userid');
        if (location) {
            console.log('storedId:getUserId::',storedId);
            if (!storedId) {
                socket.emit('getUserId');
            }
        }

        const handler = (id: string) => {

            if (!storedId) {
                LocalStorage.set('userid', id);
                sendRef.current(socket, location, id);
            }
        }

        socket.on('userUniqueId', handler);
        
        return () => {
            socket.off('userUniqueId', handler);
        };
    }, [location, socket]);


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