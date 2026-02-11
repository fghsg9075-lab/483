import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
    id: string;
    image: string;
    title?: string;
    subtitle?: string;
    link?: string;
}

interface Props {
    slides?: Slide[];
    children?: React.ReactNode[];
    autoPlay?: boolean;
    interval?: number;
    className?: string;
    showDots?: boolean;
    showArrows?: boolean;
    disableClick?: boolean;
}

export const BannerCarousel: React.FC<Props> = ({
    slides = [],
    children,
    autoPlay = false,
    interval = 5000,
    className,
    showDots = true,
    showArrows = true,
    disableClick = false
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Combine props to get total items (prioritize slides if provided, else children)
    const items = slides.length > 0 ? slides : (children || []);
    const count = items.length;

    useEffect(() => {
        if (!autoPlay || count <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % count);
        }, interval);
        return () => clearInterval(timer);
    }, [autoPlay, interval, count]);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % count);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + count) % count);
    };

    if (count === 0) return null;

    return (
        <div className={`relative overflow-hidden rounded-2xl ${className || ''}`}>
            <div 
                className="flex transition-transform duration-500 ease-in-out h-full"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {slides.length > 0 ? (
                    // Render Structured Slides
                    slides.map((slide) => (
                        <div key={slide.id} className="w-full flex-shrink-0 h-full relative">
                            <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                            {(slide.title || slide.subtitle) && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                                    {slide.title && <h4 className="font-bold text-lg leading-tight">{slide.title}</h4>}
                                    {slide.subtitle && <p className="text-xs opacity-90">{slide.subtitle}</p>}
                                </div>
                            )}
                            {slide.link && !disableClick && (
                                <a href={slide.link} className="absolute inset-0 z-10" aria-label={slide.title}></a>
                            )}
                        </div>
                    ))
                ) : (
                    // Render Children
                    children?.map((child, index) => (
                        <div key={index} className="w-full flex-shrink-0 h-full">
                            {child}
                        </div>
                    ))
                )}
            </div>

            {/* Navigation Buttons */}
            {showArrows && count > 1 && !disableClick && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-sm transition-all z-20"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-sm transition-all z-20"
                    >
                        <ChevronRight size={20} />
                    </button>
                </>
            )}

            {/* Dots */}
            {showDots && count > 1 && !disableClick && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {Array.from({ length: count }).map((_, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                            className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-4' : 'bg-white/50 w-1.5'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
