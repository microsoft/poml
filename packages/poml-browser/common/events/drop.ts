import { CardModel, TextCardContent, ImageCardContent } from '@common/types';

// export const dropHandler = async (event: DragEvent): Promise<CardModel> => {
//   const files: PastedFile[] = [];
//   let plainText = '';

//   // Process dropped files
//   if (event.dataTransfer?.files) {
//     const fileList = Array.from(event.dataTransfer.files);
//     for (const file of fileList) {
//       let content: string | ArrayBuffer;

//       // Handle images and binary files
//       if (file.type.startsWith('image/')) {
//         content = await new Promise<ArrayBuffer>((resolve, reject) => {
//           const reader = new FileReader();
//           reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
//           reader.onerror = () => reject(new Error(`Failed to read image: ${file.name}`));
//           reader.readAsArrayBuffer(file);
//         });
//       } else {
//         // For text files, read as text content
//         content = await readFileContent(file);
//       }

//       files.push({
//         name: file.name,
//         type: file.type,
//         size: file.size,
//         lastModified: file.lastModified,
//         content,
//       });
//     }
//   }

//   // Process text data
//   const htmlData = event.dataTransfer?.getData('text/html');
//   const textData = event.dataTransfer?.getData('text/plain');
//   plainText = (htmlData || textData || '').trim();

//   return { plainText, files };
// };
