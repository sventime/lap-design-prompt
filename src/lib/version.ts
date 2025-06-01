import packageJson from '../../package.json';

export const getAppVersion = () => {
  return packageJson.version;
};

export const getVersionDisplay = () => {
  const version = getAppVersion();
  const buildTime = process.env.BUILD_TIME || new Date().toISOString();
  return {
    version,
    buildTime: new Date(buildTime).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  };
};