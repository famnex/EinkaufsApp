import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Trash2, X, Timer as TimerIcon, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TimerOverlay({ timers, onUpdate, onDelete }) {
    if (!timers || timers.length === 0) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[210] flex flex-col items-end max-w-[95vw] pointer-events-none">
            <div className="flex flex-row-reverse flex-wrap justify-end gap-2 w-full">
                <AnimatePresence>
                    {timers.map((timer) => (
                        <div key={timer.id} className="transition-all duration-300 w-fit max-w-full">
                            <TimerItem
                                timer={timer}
                                onUpdate={(updates) => onUpdate(timer.id, updates)}
                                onDelete={() => onDelete(timer.id)}
                            />
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

function TimerItem({ timer, onUpdate, onDelete }) {
    const [timeLeft, setTimeLeft] = useState(timer.remaining);
    const [isExpanded, setIsExpanded] = useState(window.innerWidth > 768);
    const intervalRef = useRef(null);
    const audioRef = useRef(null);
    const alarmIntervalRef = useRef(null);

    // Format time (HH:MM:SS or MM:SS)
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // Alarm Sounds (Three Tones)
    const TONES = {
        A5: "data:audio/wav;base64,UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWAJAACA0f3vr1kVAyl4yvrytmEaAyRww/f1vGkgAyBpvPT3w3AlBBthtfD4yXgrBRharez5z4AyBxRTpuj61Ig4ChFMnuP62Y8/DA9Gl9353ZdGEA0/j9j44Z5NEww5iNL35aVUFws0gMz16KxbHAovecbz67JjIAoqcb/w7blqJQsmarjt779xKwsiY7Lp8cR5MA0eXKvm8sqANg8bVqTh8s+HPBEYT53d8tOOQxMWSZXY8tiVSRYUQ47T8dycUBoTPofN8N+jVx4SOYDH7uKpXSIRNHnB7OWvZCYRL3K76ee1aysSK2u15um7cjASJ2Wv4+rAeTUUJF6o3+vFgDsVIVih2+vKh0EYHlKb1+vOjUYaHEyU0uvSlE0dG0eNzurWmlMgGUKHyOnZoVkkGD2Aw+fcp2AnGDh5vuXfrGYsGDRzuOPhsm0wGDBtsuDit3M1GS1mrN3kvHo6GipgptrkwYA/HCdbn9blxoZEHiRVmdLlyo1KICJQk83kzZNQIyFKjcnk0ZlWJiBFhsTj1J9bKR9BgL/h16RiLR49errf2apoMR45dLTd269uNR81bq/a3LR0OR8yaKnX3bl6PiAvYqPU3r2AQyIsXZ7R38GGSCQqWJjN38WMTSYoUpLJ3smSUygnTozE3syXWCslSYC729GiYzIkQXq22dOnaTYkPXSx19WsbzklOm+s1dexdT4lNmmn0ti1ekImNGShz9m5gEcoMV+czNm9hkspL1qWyNnBi1ArLVWRxNnEkVUuLFGLwNjHllswK0yGvNfKm2AzKkiAuNbMoGU3KkV7s9TOpWo6KkF1rtLQqXA+Kj5wqdDRrnVCKztrpM3TsntGLDhmn8rTtoBKLTZhmsfUuoVPLzRclcTUvYpTMTJYkMDTwJBYMzFUirzTw5VdNTBQhbjSxZliOC9MgLTQyJ5nOy9Ie7DPyqNsPi9FdqvNy6dxQi9CcafLzat2RTA/bKLIzq97STE9Z53GzrOATTI6Y5jDz7aFUjQ5XpTAz7mKVjU3Wo+8zryPWjc2Voq5zr+TXzo1UoW1zcGYZDw0T4CxzMOcaD80THutysWhbUI0SHapyMelckY0RnKkxsiod0k1Q22gxMmse002QWmcwsmwgFA3P2WXv8qzhVQ4PWCSvMq2iVg6O12Oucq5jl08OlmJtcm7kmE+OVWFssi9lmVAOVKArse/m2pDOU97qsbBn25GOEx3psTConNJOUlzosLEpndMOUdunsDEqXxQOkVqmr7FrYBTO0NmlrvFsIRXPUFikbjFs4lbPkBfjbXFtY1fQD9bibLFuJFjQj5YhK/EupVnRD1VgKvDu5lrRz1SfKjBvZ1vSj1PeKTAvqBzTD1Mc6C+v6R4Tz5Kb5y8wKd8Uz5IbJi6waqAVj9GaJS3wbGMWkFFZJC1wbCIXUJEYYyywbKMYURDXYivwLSQZUZCWoSswLaUaEhBV4Cpv7iXbEpBVXylvbmbcE1BUniivLuedFBBUHSeuryieFJCTXCbuLylfFVCTG2Xtr2ngFlDSmmTtL2qhFxESGaPsr2tiF9GR2OLr72vi2NHRl+IrLyxj2ZJRV2Eqbyzk2pLRVqApru0lm5ORVd8o7q2mXFQRVV5oLi3nXVSRVN1nLe4oHlVRVFxmbW5onxYRk9ulbO5pYBbR01rkrG5qIReSExnjq+5qodhSUtki6y5rItkS0phh6q5ro5oTUlfhKe4sJFrT0lcgKS3sZVvUUhafKG2s5hyU0hXeZ61tJt2VUlVdpuztZ55WElTcpeytaB9WkpSb5SwtqOAXUpQbJGutqWDYEtPaY2stqeHY01OZoqptqmKZk5NY4entauNaVBMYYOkta2QbFJMXoCitK6TcFNMXH2fs7CWc1ZMWnmcsrGZdlhMWHaZsLGceVpMVnOWr7KefV1NVXCTrbKhgF9OU22Qq7Ojg2JPUmqNqbOlhmVQUWiJp7OniWhRUGWGpbKpjGtTT2ODorKqj25UT2CAoLGsknFWT159nbCtlXRYT1x6mq+umHdaT1p3mK2umnpcT1l0layvnX1fUFdxkqqvn4BhUVZuj6mwoYNkUlVsjKewo4ZmU1RpiaWvpYlpVFNnhqKvpoxsVVJkg6CvqI5vV1JigJ6uqZFyWVJgfZutqpR0W1Jeepmsq5Z3XVJdd5arrJl6X1JbdZOprJt9YVNacpGorZ2AY1RYb46mrZ+DZlRXbYukraGGaFVWaoiiraKIa1dWaIagrKSLbVhVZoOerKWOcFlVZICcq6aQcltVYn2aqqeTdV1VYHuXqaiVeF9VX3iVqKmXe2FVXXWSp6mZfWNWXHOQpaqbgGVWW3CNpKqdg2dXWm6KoqqfhWlYWWyIoKqgiGxZWGqFnqqiim5aWGiDnKmjjXFcV2aAmqikj3NdV2R9mKilkXZfV2J7lqemlHhhV2F4lKamlntjWF92kaSnmH1lWF50j6OnmYBnWV1xjKKnm4JpWlxviqCnnYVrWltth56nnodtXFtrhZ2noIpvXVppgpunoYxyXlpngJmmoo50X1pmfpelo5B2YVpke5WkpJJ5Y1pjeZKjpJR7ZFphd5CipZZ+ZltgdI6hpZiAaFtfcoygpZqCalxecImepZuFbF1eboecpZyHbl5dbIWbpZ6JcF9daoKZpJ+Lc2BcaYCXpKCNdWFcZ36Vo6GPd2NcZnuToqGReWRcZHmRoaKTfGZcY3ePoKKVfmhdYnWNn6OWgGpdYXOLnqOYgmteYHGJnKOZhG1fYG+Hm6Obhm9gX22EmaKciXFhX2yCmKKdi3NiXmqAlpKejXVjXml+lKGfjnhlXmd8kqCfkHpmXmZ6kJ+gknxoX2V4jp6glH5pX2R2jJ2hlYBrX2N0ipyhl4JtYGJyiJuhmIRuYWJwhpmhmYZwYmFvhJigmohyY2Ftgpagm4p0ZGBsgJSgnIx2ZWBqfpOfnY54ZmBpfJGenY96aGBoeo+dnpF8aWFneI2cnpJ+a2Fmdoubn5SAbGFldYqan5WCbmJkc4iZn5aEcGNjcYaYn5iGcWRjcISWnpmIc2VjboKVnpqJdWZibYCTnpqLd2dia36SnZuNeWhianyQnJyOemliaXqOnJyQfGpjaHmNm52RfmxjZ3eLmp2TgG1jZnWJmZ2Ugm9kZnSHl52VhHFlZXKFlp2WhXJlZXGElZ2Xh3RmZG+Ck5yYiXZnZG4=",
        D6: "data:audio/wav;base64,UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWAJAACA5fquPgIqlvDymSwCPKv45oMeBk+//NdtEg5k0P3GWAoZet/5s0UFJ5Dr8p4zBTil9OeJJAhLuPnacxcOX8r6yV8OGHTZ+LdLCSWJ5vKjOQc1nu/ojyoJR7L13HodD1rE98xlExhv1Pa7UQ0khOHxqD8KMpjr6ZQvC0Os8d1/Ig9WvvXPaxgXas70v1gRIn7b8KxFDTCS5umZNQ1Ape3fhScQUrjx0XEdF2XI8sJeFSF41u+wSxAujOHpnjsPPZ/p4IotEk6y7tN3IRdgwvDFYxkgc9DutFEULIfc6aJBEjqa5eCPMhNKrOvVfCYYXLztx2kdIG7L7LhXFyqB1+imRxQ3lOHhlDgVR6bn1oErGFi36spvIh9qxuq7XRspfNLnqkwXNY/c4Zk9F0Sg49iGMBlUsefMdCYfZcDovmIfKHfN5q5SGjOJ2OGdQhlBm+DYizUbUKzkzXkrIGG75sBoIidyyOWxVx0yhNPgoUgbPpbc2ZA6HE2m4c9+LyBdtuTDbSYnbsPjtFwhMH/P4KVNHjyQ2NmUPx5Kod7QgzQhWbDhxXIrJ2q+4bdiJC97yt+oUiA6i9PZmEQgR5za0Yg4Ilar3sZ3Lydmud+6ZygvdsXerFcjOYfP2ZxJIkWX19KMPSNTptvIfDMnYrTdvGwrLnLB3K9cJjeCy9mgTiRDktPSkEIkUKHYyYA3KF6w275wLy5uvNuxYSk2fsfYo1MmQY3P0pRGJk2d1cqEOylbq9jAdTMuarjZtGYsNXnD16ZYKT+Jy9KYSyhLmNLLiUAqWKbWwnk2Lmaz17ZqMDV1vtapXCs+hcjSm08qSZPPy41EK1Wi08N+Oi5jr9W4bzM0crrVrGEuPYDE0Z9ULEePy8yQSCxTndDEgj4vYKrTunM3NG62065lMTx8wNGiWC5Fi8jMlEwuUJnNxYZCMF2m0bx3OjRqstGxaTQ7eLzQpFwxRIfEzJdQL06UysWJRjFaos69ez40Z67Qs243OnW4z6dhM0KDwcuaVTFMkMfGjUoyWJ3Mvn9BNWSpzrVzOjpxtM2pZTZBf73LnVkzS4zExpBOM1WZyb+DRTZhpcy2dj06brDMrGk4QXu5yqBdNUmIwcaUUjVTlcbAh0g2X6HKt3lBOmusy65tO0B4tsmjYThIhb7Gl1Y2UZHDwIpMN1ydx7l9RDpoqMmvcT5AdLLIpWQ6R4G6xZlZOFCOwcCNUDhamsW6gUc7ZaXHsXRBQHGvx6doPEZ+t8WcXTpOir7AkFM6WJbCuoRLPGOhxbJ4REBuq8apbD9FerTEnmE8TYa7wJNXO1aSwLuHTjxgncO0e0dAbKjEq3BBRXeww6FkPkyDuMCWWj1Uj727ilE9XprBtX9KQGmkw6xzREV0rcKjaEBLgLXAmF4+U4u7u41VPlyWv7WCTUFmocGudkdFcarBpWtDSn2yv5thQFKIuLuQWEBak7y2hVBBZJ2/r3pKRW+mwKZvRUp6rr6dZUJRhbW7k1tBWZC6tohTQmKavbB9TEVso76ockdJd6u+n2hEUIKyu5VeQ1eMuLeLVkNgl7uxgE9FaqC9qXVKSXSovaFrRk9/r7uXYkRWibW3jVlEXpO5sYNSRmidu6t4TElypbuibkhOfK26mWVGVYayt5BcRV2Qt7KGVUZmmrmse09Jb6K6pHFKTnmquZtoSFSDsLeSX0ZbjbWyiFhHZJe4rH5RSm2fuaV0TU53p7ida0lTgK22lGJIWoqysotaSGKUtq2BVEprnLend09NdKS3n25LU36rtpZlSVmHsLONXUlgkbSuhFdKaZm2qHpRTXKhtqBxTVJ7qLWYaEtYha6yj2BKX46yroZZS2eXtKl9VE5wn7WidE9Seaa1mmtNV4KrspFjS16LsK6IXExllLOpf1ZObpy0o3ZRUXajtJxuTlZ/qbKTZk1diK6vi15NZJGxqoJYTmyZs6R5VFF0oLOdcFBWfaaxlWhOXIarr41hTmKOr6qEW09qlrGle1ZRcp6ynnNSVXuksZdrUFuDqa6PZE9hjK2rhl1QaJSwpn5YUnCbsaB1VFV4orCYbVFagaeukWZQYImrq4lgUGeRrqaAWlJuma+heFZVdp+vmnBTWX+lrpNpUV+HqauLYlFlj6ynglxSbZauoXpYVXSdrptyVFl8o62Ua1NehKerjWRSZIyrp4VeU2uUraJ9WlVzm62cdVZZeqCtlm1UXYKlq45nU2OKqaeHYVRqkaujf1xVcZisnXdYWHierJdwVV2Ao6qQaVRiiKeoiWNUaI+qo4FeVm+Wq555Wlh2nKuYcldcfqGqkmtVYYWlqItlVWeNqKSDYFZulKqffFxYdZqqmnRYXHyfqpNuV2CDo6iMZ1Zmi6ekhWJXbJGpoH5dWXOYqpt3Wlx6namVcFhggaKnjmlXZYilpIdkV2uPp6CAX1lxlambeVxceJuolnJZX3+gp49sWGSGo6WJZlhqjaahgmFZcJOnnHtdW3eZqJd0W199nqeRblljhKKkimhZaYuloYRjWm+Rpp19X1x1l6eYdlxffJymknBaY4KgpIxqWmiJo6GFZVptj6Wef2Fcc5WmmXheXnqappNyW2KAnqSNbFtnh6Kih2dbbI2knoBjXHKTpZp6X154mKWUdF1if52kj25bZoWgoolpW2uLo56CZFxxkaSafGFed5aklXZeYX2bo5BwXWWDn6KKa1xqiaGfhGZdb4+jm35iXnWUpJZ4X2F7maORcl5lgZ2hi2xdaYign4VoXW6Nopt/ZF90k6OXeWFhepeiknRfZICboY1uXmiGnp+HaV5tjKGcgWVfc5GimHtiYXiWopN1YGR+mqGOcF9ohJ2fiGtebIqfnINnX3GPoZl9ZGF3lKGUd2FkfZihj3JgZ4Kcn4ptX2uInpyEaWBwjaCZfmVhdpKglXliY3uXoJB0YWeBmp+Lb2Brhp2dhmpgb4yfmYBnYXSRoJZ7ZGN6laCRdWJmf5mfjHBhaoWcnYdsYW6KnpqCaGJzj5+WfGVjeJOfkndjZn6Xno1yYmmDmp2IbWFuiJ2ag2pico2el35mY3eSnpN4ZGZ8lp6OdGNpgpmciW9ibYebmoRrYnGMnZd/aGR2kJ6UemVme5Sdj3VkaYCYyItxY2yFmpqGbWNwipyYgWlkdY+dlHxmZnqTnZB3VWh/lpyMcmRshJmah25jb4mbmIJqZHSNnJV9aGZ5kZw==",
        E6: "data:audio/wav;base64,UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWAJAACA7e+EFQ936PONGwxu4vaWIQlm3PieJwdd1vqnLgVVz/uvNQVNyPy2PARGwPy+RAU/ufvFSwY4sfrLUwcxqPjSXAkroPXYZAwmmPLdbA8hj+/idRMch+vmfRcYf+bqhhwUduHtjiERbtzwlicPZtbyni0NXtDzpjMMVsn0rToLT8P1tUELSLv1vEgMQbT0wlANO63zyFcONaXxzl8QL53u1GcTKpXs2W8WJY3o3XcaIYXk4X8eHX3g5YciGnXb6I8nF27W6pYtFWbQ7J4yE1/L7aU5ElfE7qw/ElC+77NGEkq37rlMEkOw7cBUEz2p7MVbFTii6stiFzOa6NBqGS6T5dVxHCmL4tl5ICWE3tyAJCJ82uCIKB911eKPLRxt0OWWMhpmy+adOBlfxeikPRhYwOirRBhSueixShhMs+i3UBhGrOe9VxlApebDXhs7nuTIZR02l+LMbB8xkN/RcyItidzVeiYqgtjYgSone9TbiC4kdNDdjzIibcvfljcgZsbhnT0eYMHio0IeWbvjqkgdU7XjsE4dTq/itVQeSKnhu1sfQ6LgwGEhPfzexWgjOZXcyW4lNY7ZzXUoMYjW0XwrLoHT1IMvK3rP1okzKHTL2ZA3Jm3G25Y8JWfB3JxBJGG83aJGI1u33ahMI1Wx3a5SI0+r3bNYJEql3LheJUWf271kJkGZ2cJqKDyT18ZwKziM1Ml3LTWG0c19MTKAztCDNC95ytKKOC1zxtSQPCttwtaWQSlnvdecRShhuNiiSihcs9inUChWrtisVShRqNixWylMote2YSpIndW7ZitDl9S/bC0/kdLCcjA8i8/GeDI5hczJfjU2f8nMhDkzecXOij0xc8HQkEEvbb3RlkUuZ7nSm0ktYrTToU4tXa/TplMtWKrTq1gtU6XTr14uTqDStGMvSprQuGkwRpTPvG4yQo/Nv3Q0P4nKw3o3PIPHxX86OX7EyIU9N3jByotBNXO9zJBFM225zZVJMmi1zptNMmOxz6BSMV6sz6VXMVmnz6lbMlWizq5hMlCdzbJmM0yYzLZrNUmSyrlwN0WNyL12OUKIxr97PD+Cw8KAPj19wMSGQjt4vcaLRTlyuciQSTdttcmVTTZoscqaUTZkrcqfVTVfqcujWjZapMqoXjZWn8qsYzdSmsmwaDhOlsezbTlLkMa3cjtIi8S6dz1FhsK8fEBCgb+/gUJAfLzBhkY+d7nDi0k8crXEkEw7brLFlVA6aa7GmVQ6ZKrGnlg6YKbGolw6XKHGpmE6WJ3GqmU7VJjFrmo8UZPDsW8+TY/CtHQ/SorAt3hBSIW+un1ERYC7vIJGQ3y4vodJQXe1v4tMQHKywZBQP26uwpRTPmmrwplXPmWnw51bPWGjw6FfPl2fwqVjPlmawqhoP1aWwaxsQFOSv69xQVCNvrJ1Q02JvLR6RUqEurd+R0iAt7mDSkZ7tbuHTUV3sryMUENyr72QU0Juq76UVkJqqL+YWkFmpL+cXkFioL+gYkFenL+jZkJbmL6nakNYlL2qbkRVkLytckVSjLqwdkdPh7iye0lNg7a0f0tLf7S2g01Je7G4iFBIdq+5jFNGcqy6kFZFbqi7lFlFaqW7mF1FZ6K8m2BEY567n2RFYJq7omhFXJa6qxTVlXeqetiFtSdqSujF5Rc6Gvj2BRcJ6vkmNRbZywlWZQapmW/fL8lW1NolK2ZbVRlkayccFRjjquec1Vhi6ugdlZfiKmieVddhaikfFlbgqelf1paf6Wng1xZfKOohl5YeaGpiGBXdp+qi2JWc52qjmRWcJqqkWdWbpiqlGlWa5WqlmxWaZOqmG9WZpCqm3JXZI2pnXRYYoqon3dYYIenoHpaX4Smon1bXYGkpIBdXH+jpYNeW3yhpoZgWnmfp4liWXadp4tkWHObqI5mWHGYqJBpWG6WqJNrWGyUqJVuWGqRqJdwWGeOp5pzWWWMp5x2WmSJpp14W2KGpZ97XGCEo6B+XV+BoqKAX15+oKODYF17n6SGYlx5naWIZFt2m6WLZlp0maaOaFpxl6aQalpvlKaSbVptkqaUb1pqkKWXcltojaWZdFtni6Sad1xliKOceV1jhqKefF5ig6Gffl9ggKCggWFffp6hg2Jee52ihmReeZujiGZddpmji2hcdJekjWpccpWkj2xcb5Okkm5cbZGklHBca46jlnNdaYyjl3VdaIqimXheZoehm3pfZYWgnHxgY4KfnX9hYoCen4FjYX6coIRkYHuboIZmX3mZoYhoX3aXoYtpXnSWoo1rXnKUoo9tXnCSopFvXm6PopNyXmyNoZV0X2qLoZZ2X2mJoJh4YGeGn5p7YWaEnpt9YmWCnZx/Y2OAnJ2CZWJ9m56EZmJ7mZ+GaGF5mJ+IaWB3lqCKa2B1lKCNbWBykqCPb2BxkKCQcWBvjqCSc2BtjJ+UdWFrip+Wd2FqiJ6XeWJohp6Ye2NnhJ2afmRmgZubgGVlf5qcgmZkfZmchGhje5idhmljeZaeiGtid5SeimxidZOejG5ic5GejnBicY+ekHJib42eknRibouek3ZjbImdlXhja4edlnpkaYWcl3xlaIObmH5mZ4GamYBnZn+ZmoJoZX2Xm4RpZXuWnIZrZHmVnIhsZHeTnIpuY3WRnYxvY3OQnY5xY3KOnY9zZHCMnJF1ZG6KnJI="
    };

    // Countdown Logic
    useEffect(() => {
        let interval = null;
        if (timer.isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timer.isRunning, timeLeft > 0]);

    // Alarm Logic
    useEffect(() => {
        if (timeLeft === 0 && timer.isRunning) {
            startAlarm();
            setIsExpanded(true); // Auto-expand when finished
        } else {
            stopAlarm();
        }

        return () => {
            stopAlarm();
        };
    }, [timeLeft === 0, timer.isRunning]);

    // Update parent state periodically
    useEffect(() => {
        onUpdate({ remaining: timeLeft });
    }, [timeLeft]);

    const startAlarm = () => {
        if (alarmIntervalRef.current) return;
        console.log("ALARM: Starting for timer", timer.label);

        const playTone = (base64) => {
            const audio = new Audio(base64);
            audio.play().catch(e => console.warn("Alarm tone failed", e));
        };

        const playMelody = () => {
            console.log("ALARM: Playing melody iteration...");
            playTone(TONES.A5);
            setTimeout(() => playTone(TONES.D6), 250);
            setTimeout(() => playTone(TONES.E6), 500);
        };

        playMelody();
        alarmIntervalRef.current = setInterval(playMelody, 3000);
    };

    const stopAlarm = () => {
        if (alarmIntervalRef.current) {
            console.log("ALARM: Stopping interval for timer", timer.label);
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }
        // No need to stop individual audio elements as they are 
        // short-lived one-shot playbacks.
    };

    const progress = (timeLeft / timer.duration) * 100;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            onClick={() => !isExpanded && setIsExpanded(true)}
            className={cn(
                "bg-card border border-border rounded-2xl shadow-xl flex flex-col pointer-events-auto cursor-pointer overflow-hidden transition-all duration-300",
                isExpanded ? "p-3 md:p-4 gap-1 md:gap-2 min-w-[200px] md:min-w-[280px] w-full" : "p-2 h-12 justify-center gap-0.5 min-w-[120px] w-auto",
                timeLeft === 0 && "ring-2 ring-red-500 animate-pulse bg-red-50 dark:bg-red-950/20"
            )}
        >
            {/* Header / Compact Title */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground min-w-0">
                    <TimerIcon size={isExpanded ? 16 : 14} className={cn("shrink-0", timeLeft === 0 && "text-red-500")} />
                    <span className={cn(
                        "font-bold uppercase tracking-wider truncate",
                        isExpanded ? "text-[10px] md:text-xs" : "text-[10px]"
                    )}>
                        {timer.label}
                    </span>
                    {!isExpanded && (
                        <span className={cn(
                            "text-[10px] font-mono ml-1 shrink-0",
                            timeLeft === 0 ? "text-red-500 font-black animate-pulse" : "text-foreground"
                        )}>
                            {formatTime(timeLeft)}
                        </span>
                    )}
                </div>
                {isExpanded && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                        className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground shrink-0 ml-auto"
                        title="Minimieren"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-2 md:gap-3"
                    >
                        <div className="flex items-center justify-between gap-1.5 shrink-0">
                            <div className={cn(
                                "text-2xl md:text-3xl font-black font-mono tracking-tighter shrink-0",
                                timeLeft === 0 ? "text-red-500" : "text-foreground"
                            )}>
                                {formatTime(timeLeft)}
                            </div>

                            <div className="flex gap-1.5 shrink-0">
                                {timeLeft > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUpdate({ isRunning: !timer.isRunning }); }}
                                        className={cn(
                                            "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all",
                                            timer.isRunning
                                                ? "bg-secondary text-secondary-foreground"
                                                : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        )}
                                    >
                                        {timer.isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 transition-all"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Progress Bar */}
            <div className={cn(
                "w-full bg-muted rounded-full overflow-hidden shrink-0",
                isExpanded ? "h-1.5 md:h-2 mt-1" : "h-[3px] mt-0.5"
            )}>
                <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: `${progress}%` }}
                    className={cn(
                        "h-full transition-colors",
                        timeLeft === 0 ? "bg-red-500" : "bg-primary"
                    )}
                />
            </div>

            {isExpanded && timeLeft === 0 && (
                <div className="text-[8px] md:text-[10px] text-red-500 font-bold text-center uppercase tracking-widest mt-0.5 animate-bounce">
                    Zeit abgelaufen!
                </div>
            )}
        </motion.div>
    );
}
