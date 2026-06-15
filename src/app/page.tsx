'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Feather } from 'lucide-react';
import { useGoogleFonts } from '@/hooks/use-google-fonts';

// Página de boas-vindas que redireciona para a página principal de frases.
export default function RootPage() {
  const router = useRouter();
  useGoogleFonts();

  useEffect(() => {
    // Redireciona diretamente para a página /frases após um curto período.
    const timer = setTimeout(() => {
        router.replace('/frases');
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  // Exibe uma tela de carregamento/boas-vindas enquanto espera.
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background text-center p-4">
        <div className="animate-pulse">
            <Feather className="h-20 w-20 text-primary" />
        </div>
        <h1 className="mt-8 font-headline text-4xl font-bold text-foreground md:text-5xl">
            InspireMe
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
            Carregando sua dose diária de inspiração...
        </p>
    </div>
  );
}
