import { Language } from '../enums/language.enum';

export const HELLO_WORLD_TEMPLATES: Record<Language, string> = {
  [Language.PYTHON]: `print("Hello, World!")`,

  [Language.JAVASCRIPT]: `console.log("Hello, World!");`,

  [Language.JAVA]: `
    public class Main {
        public static void main(String[] args) {
            System.out.println("Hello, World!");
        }
    }`,

  [Language.CPP]: `
  #include <iostream>

  int main() {
      std::cout << "Hello, World!" << std::endl;
      return 0;
  }`,

  [Language.C]: `
  #include <stdio.h>

  int main() {
      printf("Hello, World!\n");
      return 0;
  }`,
};
