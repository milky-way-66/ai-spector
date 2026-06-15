import {type ReactNode} from 'react';
import {Redirect} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function Home(): ReactNode {
  const {i18n} = useDocusaurusContext();
  const path =
    i18n.currentLocale === i18n.defaultLocale
      ? '/docs'
      : `/${i18n.currentLocale}/docs`;
  return <Redirect to={path} />;
}
