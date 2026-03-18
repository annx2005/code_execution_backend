import { Language } from '../../code-sessions/enums/language.enum';

export interface LanguageConfig {
  image: string;
  cmd: string[];
}

const executeHeredoc = (
  filename: string,
  sourceCode: string,
  runCmd: string,
) => {
  const delimiter = `EOF_${Date.now()}`;
  return [
    'sh',
    '-c',
    `cat << '${delimiter}' > ${filename}\n${sourceCode}\n${delimiter}\n${runCmd}`,
  ];
};

export const getLanguageConfig = (
  language: string,
  sourceCode: string,
): LanguageConfig => {
  const configs: Record<string, LanguageConfig> = {
    [Language.PYTHON]: {
      image: 'python:3.10-alpine',
      cmd: ['python3', '-c', sourceCode],
    },
    [Language.JAVASCRIPT]: {
      image: 'node:20-alpine',
      cmd: ['node', '-e', sourceCode],
    },
    [Language.CPP]: {
      image: 'gcc:13',
      cmd: executeHeredoc(
        'main.cpp',
        sourceCode,
        'g++ -O2 main.cpp && ./a.out',
      ),
    },
    [Language.C]: {
      image: 'gcc:13',
      cmd: executeHeredoc('main.c', sourceCode, 'gcc -O2 main.c && ./a.out'),
    },
    [Language.JAVA]: {
      image: 'eclipse-temurin:17-jdk',
      cmd: executeHeredoc('Main.java', sourceCode, 'java Main.java'),
    },
  };

  return configs[language] || configs[Language.PYTHON];
};
