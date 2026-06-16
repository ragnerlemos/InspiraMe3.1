import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const APP_STORAGE_FOLDER = 'InspiraMe3.0';

export type SaveAppFileResult = {
  uri: string;
};

export const ensureAppStoragePermission = async (): Promise<boolean> => {
  try {
    const permissions = await Filesystem.requestPermissions();
    return permissions.publicStorage === 'granted';
  } catch (error) {
    console.error('Erro ao solicitar permissão de armazenamento:', error);
    return false;
  }
};

export const saveFileToAppFolder = async (
  base64Data: string, 
  filename: string, 
  category?: string
): Promise<SaveAppFileResult> => {
  const cleanCategory = category ? category.trim().replace(/[/\\?%*:|"<>]/g, '-') : '';
  
  // No Android, tentamos salvar na pasta pública de Downloads/InspiraMe
  if (Capacitor.getPlatform() === 'android' || Capacitor.isNativePlatform()) {
    try {
      await ensureAppStoragePermission();
      
      const folderPath = cleanCategory 
        ? `Download/InspiraMe/${cleanCategory}` 
        : `Download/InspiraMe`;
      
      await Filesystem.mkdir({
        path: folderPath,
        directory: Directory.ExternalStorage,
        recursive: true,
      });

      const result = await Filesystem.writeFile({
        path: `${folderPath}/${filename}`,
        data: base64Data,
        directory: Directory.ExternalStorage,
      });

      if (result.uri) {
        return { uri: result.uri };
      }
    } catch (error) {
      console.warn('Falha ao salvar na pasta pública de Downloads. Tentando pasta Documents do App:', error);
    }
  }

  // Fallback padrão ou outros sistemas (iOS, etc.) - Salva no Documents do App
  const directory = Directory.Documents;
  const folderPath = cleanCategory 
    ? `${APP_STORAGE_FOLDER}/${cleanCategory}` 
    : `${APP_STORAGE_FOLDER}`;

  try {
    await Filesystem.mkdir({
      path: folderPath,
      directory,
      recursive: true,
    });
  } catch (error) {
    console.warn('Não foi possível criar a pasta do app nos documentos (pode já existir):', error);
  }

  const result = await Filesystem.writeFile({
    path: `${folderPath}/${filename}`,
    data: base64Data,
    directory,
  });

  if (!result.uri) {
    throw new Error('Não foi possível salvar o arquivo.');
  }

  return { uri: result.uri };
};

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
