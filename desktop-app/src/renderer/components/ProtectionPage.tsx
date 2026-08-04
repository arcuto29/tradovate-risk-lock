import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';
import { TradingProfileCard } from './TradingProfileCard';
import { SessionHours } from './SessionHours';
import { PsychologyCoach } from './PsychologyCoach';
import { AdvancedProtection } from './AdvancedProtection';
import { DayRules } from './DayRules';
import { Blocklist } from './Blocklist';

type Section = 'session' | 'coach' | 'advanced' | 'dayrules' | 'blocklist' | null;

interface Props {
  isLocked: boolean;
}

/**
 * Protection Page — All protection settings in collapsible accordions.
 * Only one section open at a time. Smooth animations.
 */
export const ProtectionPage: React.FC<Props> = ({ isLocked }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [openSection, setOpenSection] = useState<Section>('session');

  const toggle = (section: Section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Trading Profile + Plan (always visible, not collapsible) */}
      <TradingProfileCard isLocked={isLocked} />

      {/* Accordion Sections */}
      <div className="space-y-3">
        <AccordionSection
          title="Session Hours"
          subtitle="When you're allowed to trade"
          section="session"
          openSection={openSection}
          onToggle={toggle}
          colors={colors}
        >
          <SessionHours isLocked={isLocked} />
        </AccordionSection>

        <AccordionSection
          title="Psychology Coach"
          subtitle="Cooldowns, loss streaks, win protection"
          section="coach"
          openSection={openSection}
          onToggle={toggle}
          colors={colors}
        >
          <PsychologyCoach isLocked={isLocked} />
        </AccordionSection>

        <AccordionSection
          title="Advanced Protection"
          subtitle="Anti-pyramiding, stacking limits"
          section="advanced"
          openSection={openSection}
          onToggle={toggle}
          colors={colors}
        >
          <AdvancedProtection isLocked={isLocked} />
        </AccordionSection>

        <AccordionSection
          title="Day Rules"
          subtitle="Per-weekday overrides"
          section="dayrules"
          openSection={openSection}
          onToggle={toggle}
          colors={colors}
        >
          <DayRules isLocked={isLocked} />
        </AccordionSection>

        <AccordionSection
          title="Platform Blocklist"
          subtitle="Block apps and websites while locked"
          section="blocklist"
          openSection={openSection}
          onToggle={toggle}
          colors={colors}
        >
          <Blocklist isLocked={isLocked} />
        </AccordionSection>
      </div>
    </div>
  );
};

// ─── Accordion Section Component ────────────────────────────────────────────

interface AccordionProps {
  title: string;
  subtitle: string;
  section: Section;
  openSection: Section;
  onToggle: (section: Section) => void;
  colors: any;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionProps> = ({ title, subtitle, section, openSection, onToggle, colors, children }) => {
  const isOpen = openSection === section;

  return (
    <div className="relative rounded-xl overflow-hidden card-premium">
      {/* Header (always visible, clickable) */}
      <button
        onClick={() => onToggle(section)}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-all hover:bg-white/[0.01]"
      >
        <div>
          <h3 className="text-sm font-bold text-white/70">{title}</h3>
          <p className="text-[0.55rem] text-white/25 mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown
          size={16}
          className="transition-transform duration-300"
          style={{
            color: isOpen ? colors.primary : 'rgba(255,255,255,0.2)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Content (collapsible) */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? '2000px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-5 pb-5 border-t border-white/[0.04]">
          <div className="pt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
