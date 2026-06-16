
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, Search, Copy, Film, Share2, LayoutGrid, Download, MoreVertical, Sun, Calendar, Moon, MessageSquare, Quote, CircleDollarSign, PartyPopper, Gift, Egg, HeartHandshake, TestTube, ImageUp, Edit, ZoomIn, BookOpen, Loader2, ChevronRight, RefreshCw, type LucideIcon } from 'lucide-react';
import { useWindowSize } from 'react-use';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/hooks/use-favorites';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientOnly } from '@/components/client-only';
import { getApiUrl, fetchWithBase } from '@/lib/api-client';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import * as htmlToImage from 'html-to-image';
import { useProfile } from '@/hooks/use-profile';
import { ModeloTwitter } from '../editor-de-video/modelos/modelo-twitter';
import type { EditorState, EstiloTexto } from '../editor-de-video/tipos';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { ensureAppStoragePermission, saveFileToAppFolder } from '@/lib/file-storage';

interface QuoteWithAuthor {
    id: string;
    quote: string;
    author?: string;
    category: string;
    subCategory?: string;
}

interface CategoriesHierarchy {
  [mainCategory: string]: string[];
}

type FrasesClientPageProps = {
  initialQuotes: QuoteWithAuthor[];
  initialMainCategories: string[];
  initialSubCategories: CategoriesHierarchy;
  pageTitle?: string;
};

function generateFilename(quote: QuoteWithAuthor, format: 'png' | 'jpeg' | 'jpg'): string {
    const safeCategory = quote.category?.replace(/\s+/g, '-') || 'Geral';
    const safeSubCategory = quote.subCategory?.replace(/\s+/g, '-');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

    const parts = ['InspiraMe', safeCategory];
    if (safeSubCategory && safeSubCategory !== 'Todos') {
        parts.push(safeSubCategory);
    }
    parts.push(timestamp);
    
    return `${parts.join('_')}.${format}`;
}

// Componente para gerar e pré-visualizar o meme
function MemeGenerator({ quote, profile, editorState, onClose, shareDirectly = false, onCopy }: {
  quote: QuoteWithAuthor;
  profile: ReturnType<typeof useProfile>['profile'];
  editorState: EditorState;
  onClose: () => void;
  shareDirectly?: boolean;
  onCopy: (text: string, author?: string) => Promise<void>;
}) {
  const memeRef = useRef<HTMLDivElement>(null);
  const [memeUrl, setMemeUrl] = useState<string | null>(null);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const { toast } = useToast();

  const handleTextBoxResize = (_next: { widthPct: number; heightPx: number }) => {
    // preview não precisa refletir a mudança ativa de caixa de texto
  };

  const handleTextChange = (_text: string) => {
    // preview apenas gera imagem; edição inline não precisa ser persistida aqui
  };

  const baseTextStyle: EstiloTexto = {
      fontFamily: editorState.fontFamily,
      fontSize: `${editorState.fontSize}cqw`,
      fontWeight: editorState.fontWeight,
      fontStyle: editorState.fontStyle,
      color: editorState.textColor,
      textAlign: editorState.textAlign,
      lineHeight: editorState.lineHeight,
  };

  useEffect(() => {
    const generateAndProcess = async () => {
      if (!memeRef.current) return;
      
      try {
        await document.fonts.ready;
        await new Promise(resolve => setTimeout(resolve, 300)); // Aguarda a renderização
        
        const dataUrl = await htmlToImage.toJpeg(memeRef.current, {
            quality: 0.95,
            pixelRatio: 2,
            backgroundColor: '#000000'
        });
        if (!dataUrl) {
            throw new Error("Falha ao gerar a imagem em formato JPEG.");
        }
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        if (!blob) {
            throw new Error("Falha ao processar o blob da imagem.");
        }
        
        const filename = generateFilename(quote, 'jpg');

        if (shareDirectly) {
            if (Capacitor.isNativePlatform()) {
                // Lógica para App Nativo
                const reader = new FileReader();
                reader.onloadend = async () => {
                    try {
                        const base64Data = reader.result?.toString().split('base64,')[1];
                        if (!base64Data) {
                            throw new Error("Não foi possível extrair os dados da imagem.");
                        }

                        const permissionGranted = await ensureAppStoragePermission();
                        if (!permissionGranted) {
                            throw new Error('Permissão de armazenamento não concedida.');
                        }
                        
                        const { uri } = await saveFileToAppFolder(base64Data, filename, quote.category);
                        if (!uri) throw new Error("Não foi possível salvar o arquivo na pasta do app.");
                        await Share.share({ url: uri });
                    } catch (error) {
                        console.error('Erro no compartilhamento nativo:', error);
                        toast({
                            variant: 'destructive',
                            title: 'Erro',
                            description: 'Não foi possível compartilhar a imagem pelo app.',
                        });
                    } finally {
                        onClose();
                    }
                };
                reader.onerror = () => {
                    toast({
                        variant: 'destructive',
                        title: 'Erro',
                        description: 'Falha ao preparar a imagem para compartilhamento.',
                    });
                    onClose();
                };
                reader.readAsDataURL(blob);
            } else {
                // Lógica para Web
                const memeFile = new File([blob], filename, { type: 'image/jpeg' });
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [memeFile] })) {
                    try {
                        await navigator.share({
                            files: [memeFile],
                        });
                        onClose(); // Fecha apenas se o compartilhamento for iniciado
                    } catch(error) {
                        if (error instanceof DOMException && error.name === 'AbortError') {
                            console.log("Compartilhamento cancelado pelo usuário.");
                        } else {
                            console.error('Web Share API error:', error);
                        }
                        await onCopy(quote.quote, quote.author);
                        onClose();
                    }
                } else {
                    toast({
                        title: "Compartilhamento não suportado",
                        description: "Seu navegador não suporta o compartilhamento direto de imagens. Você pode baixar a imagem e compartilhar manualmente.",
                    });
                    setMemeUrl(URL.createObjectURL(blob)); // Permite download
                    return; // Return to show the download preview
                }
            }
        } else {
            // Lógica para download (preview)
            setMemeUrl(URL.createObjectURL(blob));
        }
      } catch (error) {
        console.error('Erro ao gerar/compartilhar meme:', error);
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.log("Compartilhamento cancelado pelo usuário.");
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível ${shareDirectly ? 'compartilhar' : 'gerar'} o meme. ${error instanceof Error ? error.message : ''}` });
        }
        onClose();
      }
    };

    generateAndProcess();

    return () => {
        if (memeUrl) {
            URL.revokeObjectURL(memeUrl);
        }
    }
  }, [shareDirectly, quote, toast, onClose]);

  const handleDownloadClick = async () => {
    if (!memeUrl) return;
    
    const filename = generateFilename(quote, 'jpg');

    if (Capacitor.isNativePlatform()) {
      try {
        const response = await fetch(memeUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Data = reader.result?.toString().split('base64,')[1];
          if (base64Data) {
            try {
              const { uri } = await saveFileToAppFolder(base64Data, filename, quote.category);
              toast({ title: 'Sucesso!', description: `Meme salvo na pasta Download/InspiraMe/${quote.category || ''}` });
            } catch (fallbackError) {
              console.error(fallbackError);
              toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Não foi possível salvar a imagem.' });
            }
          }
          onClose();
        };
      } catch (err) {
        console.error("Erro ao converter blob nativamente:", err);
        toast({ variant: 'destructive', title: 'Erro de download', description: 'Ocorreu um erro ao baixar a imagem.' });
        onClose();
      }
      return;
    }

    const link = document.createElement('a');
    link.href = memeUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: 'Sucesso!', description: `Seu meme foi baixado como ${filename}.` });
    onClose();
  };

  // Se for para compartilhar diretamente e não houver fallback para download, apenas exibe o loader
  if (shareDirectly && !memeUrl) {
      return (
          <>
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
              <div className="text-white text-center flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-lg font-bold">Preparando imagem...</p>
              </div>
            </div>
            {/* Div oculta para renderização inicial */}
            <div className="fixed top-[-9999px] left-[-9999px]">
                <div 
                    ref={memeRef} 
                    className="relative overflow-hidden flex flex-col justify-center bg-black"
                    style={{ width: '500px', aspectRatio: '9 / 16', backgroundColor: '#000000' }}
                >
                    <ModeloTwitter
                        editorState={editorState}
                        profile={profile}
                        baseTextStyle={baseTextStyle}
                        textEffectsStyle={{}}
                        dropShadowStyle={{}}
                        isTextSelected={isTextSelected}
                        setIsTextSelected={setIsTextSelected}
                        onTextBoxResize={handleTextBoxResize}
                        onTextChange={handleTextChange}
                    />
                </div>
            </div>
          </>
      );
  }

  // Renderiza a pré-visualização para download
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            {memeUrl ? (
                 <div className="flex flex-col items-center gap-4">
                    <p className="text-white text-lg font-bold">Clique no meme para baixar</p>
                    <img 
                        src={memeUrl} 
                        alt="Pré-visualização do Meme" 
                        className="max-w-[80vw] max-h-[70vh] rounded-lg shadow-2xl cursor-pointer"
                        style={{ aspectRatio: '9 / 16' }}
                        onClick={handleDownloadClick}
                    />
                 </div>
            ) : (
                <div className="text-white text-center flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-lg font-bold">Gerando seu meme...</p>
                </div>
            )}
            {/* Div oculta para renderização inicial */}
            <div className="fixed top-[-9999px] left-[-9999px]">
                <div 
                    ref={memeRef} 
                    className="relative overflow-hidden flex flex-col justify-center bg-black"
                    style={{ width: '500px', aspectRatio: '9 / 16', backgroundColor: '#000000' }}
                >
                    <ModeloTwitter
                        editorState={editorState}
                        profile={profile}
                        baseTextStyle={baseTextStyle}
                        textEffectsStyle={{}}
                        dropShadowStyle={{}}
                        isTextSelected={isTextSelected}
                        setIsTextSelected={setIsTextSelected}
                        onTextBoxResize={handleTextBoxResize}
                        onTextChange={handleTextChange}
                    />
                </div>
            </div>
        </div>
    </div>
  );
}


const getCategoryIcon = (categoryName: string): LucideIcon => {
    const lowerCaseName = categoryName.toLowerCase();

    if (lowerCaseName.includes('bom dia')) return Sun;
    if (lowerCaseName.includes('boa noite')) return Moon;
    if (lowerCaseName.includes('indireta')) return Quote;
    if (lowerCaseName.includes('teste')) return TestTube;
    if (lowerCaseName.includes('fim de mês')) return CircleDollarSign;
    if (['sábado', 'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta'].some(dia => lowerCaseName.includes(dia))) return Calendar;
    if (lowerCaseName.includes('namorados')) return HeartHandshake;
    if (lowerCaseName.includes('pais')) return Gift;
    if (lowerCaseName.includes('páscoa')) return Egg;
    if (lowerCaseName.includes('festa junina')) return PartyPopper;
    if (lowerCaseName.includes('datas comemorativas')) return Calendar;

    return BookOpen;
}

export function FrasesClientPage({
  initialQuotes,
  initialMainCategories,
  initialSubCategories,
  pageTitle = "Inspire-se com Frases",
}: FrasesClientPageProps) {
  const [allQuotes, setAllQuotes] = useState<QuoteWithAuthor[]>(initialQuotes);
  const [isLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('Todos');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Todos');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  
  const [quoteForMeme, setQuoteForMeme] = useState<{ quote: QuoteWithAuthor; action: 'preview' | 'share'; } | null>(null);

  const { favorites, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const router = useRouter();
  const { profile } = useProfile();
  const { width } = useWindowSize();
  
  const cols = width >= 1024 ? 3 : 2;

  const handleRefreshQuotes = async () => {
    setIsRefreshing(true);

    try {
      // Invalida cache no servidor primeiro
      await fetchWithBase('/api/invalidate-cache', { method: 'POST' });
      
      // Busca os novos dados diretamente via API em vez de router.refresh()
      // router.refresh() não atualiza o estado local em builds estáticos/APK
      const response = await fetchWithBase('/api/quotes');
      if (response.ok) {
        const newData = await response.json();
        if (Array.isArray(newData)) {
          setAllQuotes(newData);
        }
      }
      
      toast({ title: 'Dados atualizados', description: 'Os dados da planilha foram recarregados.' });
    } catch (error) {
      console.error('Falha ao atualizar dados:', error);
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: 'Não foi possível atualizar os dados agora.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Se estiver no APK, fazemos um fetch inicial para garantir dados novos
    if (Capacitor.isNativePlatform()) {
      const loadFreshData = async () => {
        try {
          const response = await fetchWithBase('/api/quotes');
          if (response.ok) {
            const newData = await response.json();
            if (Array.isArray(newData)) {
              setAllQuotes(newData);
            }
          }
        } catch (err) {
          console.error("Erro ao carregar dados frescos no APK:", err);
        }
      };
      loadFreshData();
    }
  }, []);

  useEffect(() => {
    setAllQuotes(initialQuotes);
  }, [initialQuotes]);

  useEffect(() => {
    const mainCatFromUrl = searchParams.get('mainCategory');
    const subCatFromUrl = searchParams.get('subCategory');
    if (mainCatFromUrl) {
      setSelectedMainCategory(mainCatFromUrl);
    }
    if (subCatFromUrl) {
      setSelectedSubCategory(subCatFromUrl);
    }
  }, [searchParams]);
  
  const filteredQuotes = useMemo(() => {
    let quotes = allQuotes;

    if (selectedMainCategory !== 'Todos') {
      quotes = quotes.filter(
        q => q.sheetName === selectedMainCategory || q.category === selectedMainCategory || q.subCategory === selectedMainCategory
      );
    }

    if (selectedSubCategory !== 'Todos') {
      quotes = quotes.filter(
        q => q.category === selectedSubCategory || q.subCategory === selectedSubCategory
      );
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      quotes = quotes.filter(q => 
          q.quote.toLowerCase().includes(lowercasedTerm) ||
          (q.author && q.author.toLowerCase().includes(lowercasedTerm))
      );
    }
    
    return quotes;

  }, [allQuotes, searchTerm, selectedMainCategory, selectedSubCategory]);

  
  const handleShareMeme = (quote: QuoteWithAuthor) => {
    setQuoteForMeme({ quote, action: 'share' });
  };


  const handlePreviewMeme = (quote: QuoteWithAuthor) => {
    setQuoteForMeme({ quote, action: 'preview' });
  };
  
  const handleCopy = async (text: string, author?: string) => {
    const textToCopy = author ? `"${text}" - ${author}` : text;
    try {
        if (Capacitor.isNativePlatform()) {
            await Clipboard.write({ string: textToCopy });
            toast({ title: 'Copiado!', description: 'A frase foi copiada para a sua área de transferência.' });
            return;
        }

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
            toast({ title: 'Copiado!', description: 'A frase foi copiada para a sua área de transferência.' });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                toast({ title: 'Copiado!', description: 'A frase foi copiada para a sua área de transferência.' });
            } catch (err) {
                console.error('Falha ao usar execCommand:', err);
                toast({ title: 'Erro ao Copiar', description: 'Não foi possível copiar.', variant: 'destructive' });
            }
            document.body.removeChild(textArea);
        }
    } catch (err) {
        console.error('Falha ao copiar:', err);
        toast({ title: 'Erro ao Copiar', description: 'Não foi possível copiar a frase.', variant: 'destructive' });
    }
};

  const handleShare = async (text: string, author?: string) => {
    const shareText = author ? `${text} - ${author}` : text;

    if (Capacitor.isNativePlatform()) {
        try {
            await Share.share({
                text: shareText,
                dialogTitle: 'Compartilhar Frase'
            });
        } catch (error) {
            console.error("Erro ao usar Capacitor Share API, usando fallback de cópia:", error);
            await handleCopy(text, author);
        }
        return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        });
      } catch (error) {
        if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
           await handleCopy(text, author);
        } else {
          console.error("Erro ao compartilhar, usando fallback de cópia:", error);
          await handleCopy(text, author);
        }
      }
    } else {
      await handleCopy(text, author);
    }
  };

  const handleMainCategorySelect = (mainCategory: string) => {
    setSelectedMainCategory(mainCategory);
    setSelectedSubCategory('Todos');
    
    if (mainCategory === 'Todos' && window.innerWidth < 768) {
      setIsCategorySheetOpen(false);
    }
  };

  const handleSubCategorySelect = (mainCategory: string, subCategory: string) => {
    setSelectedMainCategory(mainCategory);
    setSelectedSubCategory(subCategory);
    if (window.innerWidth < 768) {
      setIsCategorySheetOpen(false);
    }
  };
  
  const handleCardSubCategoryClick = (subCategory: string) => {
    setSelectedMainCategory('Todos');
    setSelectedSubCategory(subCategory);
    if (isCategorySheetOpen) {
      setIsCategorySheetOpen(false);
    }
  };
  
  const handleGoToEditor = (quote: QuoteWithAuthor) => {
    const params = new URLSearchParams();
    params.set('quote', encodeURIComponent(quote.quote));
    if (quote.category) {
      params.set('category', quote.category);
    }
    if (quote.subCategory) {
      params.set('subCategory', quote.subCategory);
    }
    router.push(`/editor-de-video?${params.toString()}`);
  }

  const renderFilters = (isMobile = false) => {
    const searchInput = (
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por frases ou autores..."
          className="pl-10 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    );
  
    return (
      <div className="space-y-1">
        {searchInput}
        <Button
          variant="outline"
          onClick={handleRefreshQuotes}
          disabled={isRefreshing}
          className="w-full justify-start text-base font-semibold px-3 py-2 rounded-md"
        >
          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            handleMainCategorySelect('Todos');
          }}
          className={cn(
            'w-full justify-start text-base font-semibold px-3 py-2 rounded-md bg-secondary text-primary'
          )}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          Todos
        </Button>
        <ClientOnly>
          <Accordion type="multiple" className="w-full">
            {initialMainCategories
              .filter((cat) => cat !== 'Todos')
              .map((mainCat, index) => {
                const subCats = (initialSubCategories[mainCat] || []);
                const Icon = getCategoryIcon(mainCat);

                if (subCats.length === 0 || (subCats.length === 1 && subCats[0] === 'Todos')) {
                  return (
                    <Button
                      key={mainCat}
                      variant='ghost'
                      onClick={() => handleMainCategorySelect(mainCat)}
                      className={cn('w-full justify-start text-base font-semibold px-3 py-2 transition-colors rounded-md hover:bg-muted/50',
                        selectedMainCategory === mainCat && selectedSubCategory === 'Todos' && 'bg-primary/10 text-primary'
                      )}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {mainCat}
                    </Button>
                  );
                }
                return (
                  <AccordionItem value={`item-${index}`} key={mainCat} className='border-none'>
                    <AccordionTrigger
                      onClick={() => handleMainCategorySelect(mainCat)}
                      className={cn(
                        'font-semibold text-base hover:no-underline px-3 py-2 transition-colors rounded-md hover:bg-muted/50 w-full justify-start',
                        selectedMainCategory === mainCat && 'bg-primary/10 text-primary'
                      )}
                    >
                        <div className="flex items-center flex-1 text-left">
                            <Icon className="mr-2 h-4 w-4" />
                            {mainCat}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className='pt-1'>
                      <div className="flex flex-col items-start gap-1 pl-4 border-l-2 border-muted ml-3">
                        {subCats.map((subCat) => (
                            <Button
                              key={subCat}
                              variant="ghost"
                              onClick={() => handleSubCategorySelect(mainCat, subCat)}
                              className={cn(
                                'w-full justify-start text-sm h-8 px-3 transition-colors rounded-md hover:bg-muted/50',
                                selectedMainCategory === mainCat &&
                                  selectedSubCategory === subCat &&
                                  'bg-primary/10 text-primary font-semibold'
                              )}
                            >
                              {subCat}
                            </Button>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </ClientOnly>
      </div>
    );
  };
  
    const getCardClasses = (index: number) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const isColored = (row + col) % 2 === 0;

        return cn(
            'group flex flex-col justify-between transition-shadow duration-300 border',
            isColored
                ? 'bg-[#0a1530]/95 border-[#0a1530]/70'
                : 'bg-[#020817]/95 border-[#020817]/70'
        );
    };

  const renderSkeletons = () => (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className={getCardClasses(i)}>
                    <CardContent className="p-4 pb-0">
                        <Skeleton className="h-16 w-full" />
                    </CardContent>
                    <CardFooter className="p-4 pt-2 flex flex-col items-end gap-2">
                        <Skeleton className="h-4 w-1/3" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );

    const getMemeEditorState = (quote: QuoteWithAuthor): EditorState => {
        return {
            text: quote.quote,
            fontFamily: "Poppins",
            fontSize: profile.memeFontSize,
            fontWeight: "bold",
            fontStyle: "normal",
            textColor: "#FFFFFF",
            textAlign: "left",
            textShadowBlur: 0,
            textShadowOpacity: 0,
            textVerticalPosition: 50,
            textStrokeColor: "#000000",
            textStrokeWidth: 0,
            textStrokeCornerStyle: 'rounded',
            applyEffectsToEmojis: true,
            applyTextColorToSignature: false,
            letterSpacing: 0,
            lineHeight: 1.4,
            wordSpacing: 0,
            backgroundStyle: { type: 'solid', value: '#000000' },
            filmColor: "#000000",
            filmOpacity: 0,
            aspectRatio: '9 / 16',
            activeTemplateId: 'template-twitter',
            showProfileSignature: false,
            showLogo: profile.memeShowLogo,
            logoPositionX: 50,
            logoPositionY: 95,
            logoScale: profile.memeLogoScale,
            logoOpacity: 80,
            signaturePositionX: 50,
            signaturePositionY: 95,
            signatureScale: 60,
            showSignaturePhoto: false,
            showSignatureUsername: false,
            showSignatureSocial: false,
            showSignatureBackground: false,
            signatureBgColor: '#000000',
            signatureBgOpacity: 50,
            profileVerticalPosition: 50,
        };
    };

    const memeEditorState = quoteForMeme ? getMemeEditorState(quoteForMeme.quote) : null;
    const breadcrumbSubCategories = initialSubCategories[selectedMainCategory] || [];
  
  return (
    <>
      <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
        <SheetContent 
          side="left" 
          className="flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>Categorias</SheetTitle>
            <SheetDescription className="sr-only">Selecione uma categoria para filtrar as frases</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="py-4">{renderFilters(true)}</div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <main className="overflow-y-auto safe-area py-8">
        <div className="grid md:grid-cols-[280px_1fr] gap-8 md:items-start">
          <aside className="hidden md:block pl-4">
            <div className="sticky top-24">
              <ScrollArea type="always" className="max-h-[calc(100vh-10rem)] -mr-4 pr-4" style={{ height: '600px' }}>
                {renderFilters()}
              </ScrollArea>
            </div>
          </aside>
          <div className="px-4">
            <div className="w-full mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
               <div className="text-center md:text-left md:flex-1">
                  <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">
                    {pageTitle}
                  </h1>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshQuotes}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Atualizar
                </Button>
                <div className="md:hidden">
                  <Button variant="outline" size="icon" onClick={() => setIsCategorySheetOpen(true)}>
                      <LayoutGrid className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            
            {selectedMainCategory !== 'Todos' && (
              <div className="flex items-center text-sm mb-6">
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="link"
                      className="p-0 h-auto font-semibold text-muted-foreground hover:text-primary"
                    >
                      {selectedMainCategory}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleSubCategorySelect(selectedMainCategory, 'Todos')}>
                      Todos em {selectedMainCategory}
                    </DropdownMenuItem>
                    {breadcrumbSubCategories.map(subCat => (
                      <DropdownMenuItem key={subCat} onClick={() => handleSubCategorySelect(selectedMainCategory, subCat)}>
                        {subCat}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedSubCategory !== 'Todos' && (
                  <>
                    <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{selectedSubCategory}</span>
                  </>
                )}
              </div>
            )}
            
            {isLoading ? renderSkeletons() : filteredQuotes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuotes.map((quote, index) => {
                  const isFavorited = favorites.includes(quote.id);
                  return (
                    <Card key={quote.id} className={getCardClasses(index)}>
                      
                      <CardContent className="p-4 pb-0 flex-1">
                        <p className="text-sm font-body">{quote.quote}</p>
                      </CardContent>
                      <CardFooter className="px-4 pt-2 pb-2 flex flex-col items-stretch gap-2">
                          <div className="flex justify-between items-center w-full text-[10px]">
                              {quote.subCategory && quote.subCategory !== 'Todos' ? (
                                  <Button 
                                      variant="link" 
                                      className="p-0 h-auto text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full truncate max-w-[120px] hover:no-underline hover:bg-primary/20"
                                      onClick={() => handleCardSubCategoryClick(quote.subCategory!)}
                                  >
                                      {quote.subCategory}
                                  </Button>
                              ) : <div />}
                              {quote.author && (
                                  <p className="font-medium text-muted-foreground truncate">
                                      - {quote.author}
                                  </p>
                              )}
                          </div>
                          <div className="flex justify-end items-center w-full pt-1 -space-x-2 -mr-2">
                            <Button variant="ghost" size="icon-sm" onClick={() => handlePreviewMeme(quote)}>
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleCopy(quote.quote, quote.author)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => toggleFavorite(quote.id)}>
                              <Heart className={cn("h-4 w-4", isFavorited ? "text-red-500 fill-current" : "text-gray-400")} />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleShareMeme(quote)}>
                              <Share2 className="h-4 w-4" />
                            </Button>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleGoToEditor(quote)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edição Avançada
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleShare(quote.quote, quote.author)}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                        Compartilhar Texto
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-card border rounded-lg flex flex-col items-center">
                <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Nenhuma frase encontrada</h2>
                <p className="text-muted-foreground">Tente ajustar sua busca ou selecionar outra categoria.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <ClientOnly>
        {quoteForMeme && memeEditorState && (
          <MemeGenerator
            quote={quoteForMeme.quote}
            profile={profile}
            editorState={memeEditorState}
            onClose={() => setQuoteForMeme(null)}
            shareDirectly={quoteForMeme.action === 'share'}
            onCopy={handleCopy}
          />
        )}
      </ClientOnly>
    </>
  );
}
