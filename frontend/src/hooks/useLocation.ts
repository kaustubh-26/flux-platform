import { useEffect, useState } from "react";
import { useInternet } from "./useInternet";
import { Location } from "../interfaces/location";

export function useLocation() {
    const [location, setLocation] = useState<Location | null>(null);
    const online = useInternet();

    useEffect(() => {
        if (!online) {
            setLocation({
                city: "New Delhi",
                region: "Delhi",
                country: "India",
                lat: "28.6139",
                lon: "77.2090",
                ip: "0.0.0.0"
            });
            return;
        }

        fetch("https://ipwho.is/")
            .then((res) => res.json())
            .then((data) => {
                const loc: Location = {
                    city: data.city,
                    region: data.region,
                    country: data.country,
                    lat: data.latitude,
                    lon: data.longitude,
                    ip: data.ip
                };
                setLocation(loc);
            })
            .catch((err) => {
                console.error("Location Error:", err);
                // Fallback on error
                setLocation({
                    city: "New Delhi",
                    region: "Delhi",
                    country: "India",
                    lat: "28.6139",
                    lon: "77.2090",
                    ip: "0.0.0.0"
                });
            });

    }, [online]);

    return location;
}