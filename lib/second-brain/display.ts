import { Archive, Briefcase, Heart, Layers, Library, Target, Users } from 'lucide-react';
import type { LifeArea, NoteArea, ParaCategory } from '@/lib/supabase/types';

export const PARA_CATEGORY_ORDER: ParaCategory[] = [
  'projects',
  'areas',
  'resources',
  'archive',
];

export const PARA_CATEGORY_LABEL: Record<ParaCategory, string> = {
  projects: 'Projects',
  areas: 'Areas',
  resources: 'Resources',
  archive: 'Archive',
};

export const PARA_CATEGORY_DESCRIPTION: Record<ParaCategory, string> = {
  projects: 'O que estou entregando — esforços com prazo e objetivo claro.',
  areas: 'O que sustento — responsabilidades contínuas da vida.',
  resources: 'O que me interessa — temas, estudos, referências.',
  archive: 'O que cumpriu seu papel — fica disponível, não pesa.',
};

export const PARA_CATEGORY_ICON: Record<ParaCategory, typeof Target> = {
  projects: Target,
  areas: Layers,
  resources: Library,
  archive: Archive,
};

export function isParaCategory(value: string | null | undefined): value is ParaCategory {
  return (
    value === 'projects' ||
    value === 'areas' ||
    value === 'resources' ||
    value === 'archive'
  );
}

// =============================================================
// LifeArea helpers — still relevant for Areas folder color/icons.
// Absorbed from lib/brain/display.ts.
// =============================================================

export const LIFE_AREA_ORDER: LifeArea[] = ['professional', 'health', 'personal'];

export const LIFE_AREA_LABEL: Record<LifeArea, string> = {
  professional: 'Profissional',
  health: 'Saúde',
  personal: 'Pessoal',
};

export const LIFE_AREA_DESCRIPTION: Record<LifeArea, string> = {
  professional: 'Estratégia, produto, IA — o trabalho de CEO.',
  health: 'Treino, alimentação, recuperação.',
  personal: 'Partner, família, amigos — relacionamentos intensos.',
};

export const LIFE_AREA_ICON: Record<LifeArea, typeof Briefcase> = {
  professional: Briefcase,
  health: Heart,
  personal: Users,
};

export const AREAS_BY_LIFE_AREA: Record<LifeArea, NoteArea[]> = {
  professional: ['professional', 'cross_cutting'],
  health: ['health', 'cross_cutting'],
  personal: ['family', 'marriage', 'friends', 'cross_cutting'],
};

export const AREA_LABEL: Record<NoteArea, string> = {
  professional: 'Profissional',
  health: 'Saúde',
  family: 'Família',
  marriage: 'Casamento',
  friends: 'Amigos',
  cross_cutting: 'Transversal',
};

export function isLifeArea(value: string | null | undefined): value is LifeArea {
  return value === 'professional' || value === 'health' || value === 'personal';
}
