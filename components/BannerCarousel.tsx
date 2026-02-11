import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    children: React.ReactNode[];
    autoPlay?: boolean;
    interval?: number;
    className?: string;
}

export const BannerCarousel: React.FC<Props> = ({ children, autoPlay = false, interval = 5000, className }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % children.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + children.length) % children.length);
    };

    React.useEffect(() => {
        if (!autoPlay) return;
        const timer = setInterval(nextSlide, interval);
        return () => clearInterval(timer);
    }, [autoPlay, interval, children.length]);

    if (!children || children.length === 0) return null;

    return (
        <div className={`relative overflow-hidden rounded-2xl ${className}`}>
            <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {children.map((child, index) => (
                    <div key={index} className="w-full flex-shrink-0">
                        {child}
                    </div>
                ))}
            </div>


            {/* Dots */}
            {children.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {children.map((_, i) => (
                        <div 
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-3' : 'bg-white/50'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
