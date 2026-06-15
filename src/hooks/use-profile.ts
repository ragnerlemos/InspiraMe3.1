
"use client";

import { useState, useEffect, useCallback } from "react";

const PROFILE_KEY = "quotevid_profile";

// Definição de tipo movida para dentro do hook para evitar importações circulares
export interface ProfileData {
  username: string;
  social: string;
  photo: string | null;
  logo: string | null;
  logo2: string | null; // Novo campo para a segunda logomarca
  showIcon: boolean;
  showDate: boolean;
  iconUrl?: string;
  memeFontSize: number;
  memeShowLogo: boolean;
  memeLogoScale: number;
}

// Hook para gerenciar os dados do perfil do usuário usando o localStorage.
export const useProfile = () => {
  const [profile, setProfile] = useState<ProfileData>({
    username: "Seu Nome",
    social: "@seuusario",
    photo: null,
    iconUrl: '',
    showIcon: false,
    showDate: false,
    logo: null,
    logo2: null, // Valor inicial para a segunda logo
    memeFontSize: 1.3,
    memeShowLogo: false,
    memeLogoScale: 40,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Carrega os dados do perfil do localStorage quando o hook é montado.
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem(PROFILE_KEY);
      if (storedProfile) {
        // Garante que os novos campos tenham valores padrão se não existirem no localStorage
        const loadedProfile = JSON.parse(storedProfile);
        const defaultState: ProfileData = {
            username: "Seu Nome",
            social: "@seuusario",
            photo: null,
            iconUrl: '',
            showIcon: false,
            showDate: false,
            logo: null,
            logo2: null, // Garante valor padrão
            memeFontSize: 1.3,
            memeShowLogo: false,
            memeLogoScale: 40,
        };
        setProfile({ ...defaultState, ...loadedProfile });
      }
    } catch (error) {
      console.error("Failed to parse profile from localStorage", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Função para atualizar e salvar o perfil.
  const updateProfile = useCallback((newProfileData: Partial<ProfileData>) => {
    setProfile((prevProfile) => {
      const updatedProfile = { ...prevProfile, ...newProfileData };
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
      } catch (error) {
        console.error("Failed to save profile to localStorage", error);
      }
      return updatedProfile;
    });
  }, []);

  return { profile, updateProfile, isLoaded };
};
