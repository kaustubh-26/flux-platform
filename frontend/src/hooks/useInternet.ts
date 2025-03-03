import { useEffect, useState } from "react";

export function useInternet() {
    const [online, setOnline] = useState<boolean>(navigator.onLine);

    const checkInternet = async () => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(
                "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js",
                {
                    method: "HEAD",
                    cache: "no-cache",
                    signal: controller.signal
                }
            );

            clearTimeout(timeout);

            // HEAD request will give status 200 if internet is OK
            if (res.ok) {
                setOnline(true);
            } else {
                setOnline(false);
            }
        } catch(err) {
            setOnline(false);
        }
    }

    useEffect(() => {
        checkInternet();
    },[]);

    return online;
}