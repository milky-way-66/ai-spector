import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const courseExclude = [
  '**/vi/**',
  '**/sdk.md',
  '**/browser-integration.md',
  '**/multi-template-structure.md',
  '**/review-system-handover.md',
  '**/review-routing-impl-plan.md',
  '**/subagent-routing-design.md',
  '**/task-state-plan.md',
  '**/task-state-impl-plan.md',
  '**/workflow-redesign.md',
  '**/workflow-redesign-impl-plan.md',
];

const config: Config = {
  title: 'AI Spector',
  tagline: 'Documentation workflow in Cursor or Claude Code',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://milky-way-66.github.io',
  baseUrl: '/',
  organizationName: 'milky-way-66',
  projectName: 'ai-spector',

  onBrokenLinks: 'ignore',

  markdown: {
    format: 'md',
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'ignore',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    localeConfigs: {
      en: {label: 'English'},
      vi: {label: 'Tiếng Việt'},
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          exclude: courseExclude,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'AI Spector',
      logo: {
        alt: 'AI Spector',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'courseSidebar',
          position: 'left',
          label: 'Course',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Course',
          items: [
            {label: 'Get started', to: 'get-started'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AI Spector.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
