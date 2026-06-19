
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, Star, Search, Copy, Film, Share2, LayoutGrid, Download, MoreVertical, Sun, Calendar, Moon, MessageSquare, Quote, CircleDollarSign, PartyPopper, Gift, Egg, HeartHandshake, TestTube, ImageUp, Edit, ZoomIn, BookOpen, Loader2, ChevronRight, RefreshCw, ArrowUpDown, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/hooks/use-favorites';
import { useLikes } from '@/hooks/use-likes';
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
import { App } from '@capacitor/app';
// import { toJpeg } from 'html-to-image';
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
    sheetName?: string;
    date?: string;
    time?: string;
    rowNumber?: number;
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
  const [memeFile, setMemeFile] = useState<File | null>(null);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
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
        
        const { toJpeg } = await import('html-to-image');
        const dataUrl = await toJpeg(memeRef.current, {
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
        const fileObj = new File([blob], filename, { type: 'image/jpeg' });
        setMemeFile(fileObj);
        setMemeUrl(URL.createObjectURL(blob));

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
            }
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

  const handleShareImageClick = async () => {
    if (!memeFile) return;
    setIsSharingImage(true);
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [memeFile] })) {
        await navigator.share({
          files: [memeFile],
        });
        onClose();
      } else {
        toast({
          title: "Compartilhamento não suportado",
          description: "Seu navegador não suporta compartilhamento de arquivos. Por favor, utilize a opção de Baixar ou Copiar.",
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log("Compartilhamento cancelado pelo usuário.");
      } else {
        console.error("Erro ao compartilhar imagem:", err);
        toast({
          variant: 'destructive',
          title: 'Erro ao compartilhar',
          description: 'Não foi possível compartilhar a imagem. Tente baixar ou copiar.',
        });
      }
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleCopyImageClick = async () => {
    if (!memeUrl) return;
    setIsCopyingImage(true);
    try {
      const response = await fetch(memeUrl);
      const blob = await response.blob();
      
      if (navigator.clipboard && window.isSecureContext) {
        // Converte o jpeg/blob para png para maximizar compatibilidade com a área de transferência do sistema
        const pngBlob = await new Promise<Blob>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Erro ao criar contexto de canvas"));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error("Falha ao exportar PNG"));
                    }
                }, 'image/png');
            };
            img.onerror = () => reject(new Error("Erro ao carregar imagem para conversão"));
            img.src = URL.createObjectURL(blob);
        });

        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': pngBlob
          })
        ]);
        
        toast({ 
          title: 'Imagem Copiada!', 
          description: 'A imagem foi copiada para a sua área de transferência com sucesso.' 
        });
        onClose();
      } else {
        throw new Error("API de Área de Transferência não disponível ou contexto não seguro.");
      }
    } catch (err) {
      console.error("Erro ao copiar imagem:", err);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao copiar imagem', 
        description: 'Não foi possível copiar. Por favor, utilize a opção de Baixar.' 
      });
    } finally {
      setIsCopyingImage(false);
    }
  };

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
        <div className="relative w-full max-w-sm sm:max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            {memeUrl ? (
                 <div className="flex flex-col items-center gap-4 bg-[#020817]/95 border border-slate-800 p-6 rounded-2xl">
                    <p className="text-white text-md font-semibold text-center leading-tight">Visualizar Imagem</p>
                    <img 
                        src={memeUrl} 
                        alt="Pré-visualização do Meme" 
                        className="max-w-[75vw] max-h-[55vh] rounded-lg shadow-2xl cursor-pointer border border-[#1e293b]"
                        style={{ aspectRatio: '9 / 16' }}
                        onClick={handleDownloadClick}
                    />
                    <div className="flex flex-col gap-2 w-full mt-2">
                        {memeFile && typeof window !== 'undefined' && navigator.share && (
                          <Button
                              variant="default"
                              disabled={isCopyingImage || isSharingImage}
                              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              onClick={handleShareImageClick}
                          >
                              {isSharingImage ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                  <Share2 className="h-4 w-4" />
                              )}
                              Compartilhar Imagem
                          </Button>
                        )}
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <Button
                                variant="outline"
                                disabled={isCopyingImage || isSharingImage}
                                className="bg-[#1e293b] hover:bg-slate-800 text-slate-100 border-none font-semibold py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={handleDownloadClick}
                            >
                                <Download className="h-4 w-4" />
                                Baixar
                            </Button>
                            <Button
                                variant="secondary"
                                disabled={isCopyingImage || isSharingImage}
                                className="bg-[#1e293b] hover:bg-slate-800 text-slate-100 font-semibold py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={handleCopyImageClick}
                            >
                                {isCopyingImage ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                                Copiar Imagem
                            </Button>
                        </div>
                    </div>
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

const getQuoteLikes = (quote: QuoteWithAuthor, extraLikes: number = 0) => {
  let hash = 0;
  const str = quote.id + quote.quote;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const baseLikes = Math.abs(hash % 90) + 10;
  return baseLikes + extraLikes;
};

const getQuoteViews = (quote: QuoteWithAuthor) => {
  let hash = 0;
  const str = (quote.quote || '') + quote.id;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 900) + 100;
};

const getQuotePopularity = (quote: QuoteWithAuthor, extraLikes: number = 0) => {
  return getQuoteLikes(quote, extraLikes) * 3 + getQuoteViews(quote);
};

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
  const [sortBy, setSortBy] = useState<'recentes' | 'curtidas' | 'populares' | 'acessadas' | 'aleatorias' | 'antigas'>('recentes');
  const [randomSeed, setRandomSeed] = useState<number>(0);
  
  const [quoteForMeme, setQuoteForMeme] = useState<{ quote: QuoteWithAuthor; action: 'preview' | 'share'; } | null>(null);

  const { favorites, toggleFavorite } = useFavorites();
  const { likedIds, customCounts, toggleLike } = useLikes();
  const { toast } = useToast();
  const router = useRouter();
  const { profile } = useProfile();
  const { width } = useWindowSize();
  
  const cols = width >= 1024 ? 3 : 2;

  // Handle hardware back button on mobile
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupBackListener = async () => {
        const backListener = await App.addListener('backButton', () => {
            if (selectedSubCategory !== 'Todos' || selectedMainCategory !== 'Todos') {
                setSelectedMainCategory('Todos');
                setSelectedSubCategory('Todos');
            } else if (searchTerm) {
                setSearchTerm('');
            }
        });
        return backListener;
    };

    const listenerPromise = setupBackListener();

    return () => {
        listenerPromise.then(l => l.remove());
    };
  }, [selectedMainCategory, selectedSubCategory, searchTerm]);

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
    
    // Sort implementation based on the selected criteria
    const items = [...quotes];
    if (sortBy === 'recentes') {
      items.sort((a, b) => {
        if (a.date && b.date) {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          if (a.time && b.time) return b.time.localeCompare(a.time);
        }
        const rowA = a.rowNumber ?? 0;
        const rowB = b.rowNumber ?? 0;
        return rowB - rowA;
      });
    } else if (sortBy === 'antigas') {
      items.sort((a, b) => {
        if (a.date && b.date) {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          if (a.time && b.time) return a.time.localeCompare(b.time);
        }
        const rowA = a.rowNumber ?? 0;
        const rowB = b.rowNumber ?? 0;
        return rowA - rowB;
      });
    } else if (sortBy === 'curtidas') {
      items.sort((a, b) => {
        const extraA = customCounts[a.id] || 0;
        const extraB = customCounts[b.id] || 0;
        const scoreA = getQuoteLikes(a, extraA);
        const scoreB = getQuoteLikes(b, extraB);
        return scoreB - scoreA;
      });
    } else if (sortBy === 'populares') {
      items.sort((a, b) => {
        const extraA = customCounts[a.id] || 0;
        const extraB = customCounts[b.id] || 0;
        const popA = getQuotePopularity(a, extraA);
        const popB = getQuotePopularity(b, extraB);
        return popB - popA;
      });
    } else if (sortBy === 'acessadas') {
      items.sort((a, b) => {
        const viewsA = getQuoteViews(a);
        const viewsB = getQuoteViews(b);
        return viewsB - viewsA;
      });
    } else if (sortBy === 'aleatorias') {
      const rands = new Map<string, number>();
      items.forEach(q => {
        let hash = randomSeed;
        const str = q.id;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        rands.set(q.id, Math.sin(hash));
      });
      items.sort((a, b) => (rands.get(a.id) ?? 0) - (rands.get(b.id) ?? 0));
    }

    return items;

  }, [allQuotes, searchTerm, selectedMainCategory, selectedSubCategory, sortBy, randomSeed, favorites, customCounts]);

  
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

        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                toast({ title: 'Copiado!', description: 'A frase foi copiada para a sua área de transferência.' });
                copied = true;
            } catch (clipErr) {
                console.warn('navigator.clipboard.writeText failed, playing back fallback:', clipErr);
            }
        }

        if (!copied) {
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
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                {(selectedMainCategory !== 'Todos' || selectedSubCategory !== 'Todos' || searchTerm !== '') && (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-9"
                    onClick={() => {
                      setSelectedMainCategory('Todos');
                      setSelectedSubCategory('Todos');
                      setSearchTerm('');
                    }}
                  >
                    <ChevronRight className="mr-1 h-1.5 w-1.5 rotate-180" />
                    Voltar
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="font-semibold flex items-center gap-1.5 h-9 bg-card hover:bg-accent border-muted/50">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <span className="truncate">
                        {sortBy === 'recentes' && '🆕 Mais recentes'}
                        {sortBy === 'curtidas' && '⭐ Mais curtidas'}
                        {sortBy === 'populares' && '🔥 Mais populares'}
                        {sortBy === 'acessadas' && '📈 Mais acessadas'}
                        {sortBy === 'aleatorias' && '🎲 Aleatórias'}
                        {sortBy === 'antigas' && '📅 Mais antigas'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px] bg-[#070e1e] border-muted/50">
                    <DropdownMenuItem className={cn("cursor-pointer focus:bg-primary/10", sortBy === 'recentes' && "bg-secondary font-bold text-primary")} onClick={() => setSortBy('recentes')}>
                      🆕 Mais recentes
                    </DropdownMenuItem>
                    <DropdownMenuItem className={cn("cursor-pointer focus:bg-primary/10", sortBy === 'curtidas' && "bg-secondary font-bold text-primary")} onClick={() => setSortBy('curtidas')}>
                      ⭐ Mais curtidas
                    </DropdownMenuItem>
                    <DropdownMenuItem className={cn("cursor-pointer focus:bg-primary/10", sortBy === 'populares' && "bg-secondary font-bold text-primary")} onClick={() => setSortBy('populares')}>
                      🔥 Mais populares
                    </DropdownMenuItem>
                    <DropdownMenuItem className={cn("cursor-pointer focus:bg-primary/10", sortBy === 'acessadas' && "bg-secondary font-bold text-primary")} onClick={() => setSortBy('acessadas')}>
                      📈 Mais acessadas
                    </DropdownMenuItem>
                    <DropdownMenuItem className={cn("cursor-pointer focus:bg-primary/10", sortBy === 'aleatorias' && "bg-secondary font-bold text-primary")} onClick={() => {
                      setSortBy('aleatorias');
                      setRandomSeed(Date.now());
                    }}>
                      🎲 Aleatórias
                    </DropdownMenuItem>
                    <DropdownMenuItem className={cn("cursor-pointer focus:bg-primary/10", sortBy === 'antigas' && "bg-secondary font-bold text-primary")} onClick={() => setSortBy('antigas')}>
                      📅 Mais antigas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshQuotes}
                  disabled={isRefreshing}
                  className="h-9"
                >
                  {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Atualizar
                </Button>
                <div className="md:hidden">
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsCategorySheetOpen(true)}>
                      <LayoutGrid className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            
            {(selectedMainCategory !== 'Todos' || selectedSubCategory !== 'Todos') && (
              <div className="flex items-center text-sm mb-6 bg-secondary/30 p-2 rounded-lg">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mr-2 h-8 px-2"
                  onClick={() => {
                    setSelectedMainCategory('Todos');
                    setSelectedSubCategory('Todos');
                  }}
                >
                    <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                    Voltar
                </Button>
                <div className="h-4 w-[1px] bg-muted-foreground/30 mr-3" />
                
                {selectedMainCategory !== 'Todos' ? (
                  <>
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
                  </>
                ) : (
                  <span className="font-semibold text-foreground">Categoria: {selectedSubCategory}</span>
                )}
              </div>
            )}
            
            {selectedMainCategory === 'Todos' && searchTerm && (
                <div className="flex items-center text-sm mb-6 bg-secondary/30 p-2 rounded-lg">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mr-2 h-8 px-2"
                      onClick={() => setSearchTerm('')}
                    >
                        <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                        Limpar Busca
                    </Button>
                    <span className="text-muted-foreground">Resultados para: </span>
                    <span className="font-semibold ml-1">"{searchTerm}"</span>
                </div>
            )}
            
            {isLoading ? renderSkeletons() : filteredQuotes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuotes.map((quote, index) => {
                  const isFavorited = favorites.includes(quote.id);
                  const isLiked = likedIds.includes(quote.id);
                  const extraLikes = customCounts[quote.id] || 0;
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
                          <div className="flex items-center justify-between w-full text-[9px] text-muted-foreground/70 border-t border-muted/20 pt-1 mt-0.5">
                            <span className="flex items-center gap-0.5 font-mono">
                              ❤️ {getQuoteLikes(quote, extraLikes)} curtidas
                            </span>
                            <span className="flex items-center gap-0.5 font-mono">
                              👁️ {getQuoteViews(quote)} views
                            </span>
                          </div>
                          <div className="flex justify-end items-center w-full pt-1 -space-x-2 -mr-2">
                            <Button variant="ghost" size="icon-sm" onClick={() => handlePreviewMeme(quote)}>
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleCopy(quote.quote, quote.author)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => toggleLike(quote.id)}>
                              <Heart className={cn("h-4 w-4", isLiked ? "text-red-500 fill-current" : "text-gray-400")} />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => toggleFavorite(quote.id)}>
                              <Star className={cn("h-4 w-4", isFavorited ? "text-amber-500 fill-current" : "text-gray-400")} />
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
