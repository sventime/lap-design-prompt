'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { UploadedImage, ClothingPart, PromptType, GenderType } from '@/types';

interface FileUploadProps {
  onFilesUpload: (files: UploadedImage[]) => void;
  disabled?: boolean;
}

const CLOTHING_PARTS: { value: ClothingPart; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'dress', label: 'Dress' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'hair', label: 'Hair' },
  { value: 'features', label: 'Features' },
  { value: 'other', label: 'Other (Custom)' },
];

const PROMPT_TYPES: { value: PromptType; label: string; description: string }[] = [
  { value: 'texture', label: 'Texture', description: 'Material and texture focus' },
  { value: 'outfit', label: 'Outfit', description: 'Complete outfit visualization' },
];

export default function FileUpload({ onFilesUpload, disabled = false }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {

    setUploading(true);

    try {
      const formData = new FormData();
      acceptedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      const newFiles: UploadedImage[] = data.files.map((file: any) => ({
        id: file.id,
        file: acceptedFiles.find(f => f.name === file.name)!,
        preview: file.preview,
        clothingPart: 'top' as ClothingPart,
        promptType: 'outfit' as PromptType,
        genderType: 'female' as GenderType,
        status: 'pending' as const,
      }));

      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesUpload(updatedFiles);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [files, onFilesUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: true,
    disabled: disabled || uploading,
  });

  const removeFile = (id: string) => {
    const updatedFiles = files.filter(file => file.id !== id);
    setFiles(updatedFiles);
    onFilesUpload(updatedFiles);
  };

  const updateClothingPart = (id: string, clothingPart: ClothingPart) => {
    const updatedFiles = files.map(file =>
      file.id === id ? { ...file, clothingPart, customClothingPart: clothingPart === 'other' ? file.customClothingPart : undefined } : file
    );
    setFiles(updatedFiles);
    onFilesUpload(updatedFiles);
  };

  const updateCustomClothingPart = (id: string, customClothingPart: string) => {
    const updatedFiles = files.map(file =>
      file.id === id ? { ...file, customClothingPart } : file
    );
    setFiles(updatedFiles);
    onFilesUpload(updatedFiles);
  };

  const updatePromptType = (id: string, promptType: PromptType) => {
    const updatedFiles = files.map(file =>
      file.id === id ? { ...file, promptType } : file
    );
    setFiles(updatedFiles);
    onFilesUpload(updatedFiles);
  };

  const updateGenderType = (id: string, genderType: GenderType) => {
    const updatedFiles = files.map(file =>
      file.id === id ? { ...file, genderType } : file
    );
    setFiles(updatedFiles);
    onFilesUpload(updatedFiles);
  };

  const updateGuidance = (id: string, guidance: string) => {
    const updatedFiles = files.map(file =>
      file.id === id ? { ...file, guidance } : file
    );
    setFiles(updatedFiles);
    onFilesUpload(updatedFiles);
  };

  return (
    <div className="w-full space-y-6">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          group border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 relative overflow-hidden
          ${isDragActive ? 'border-indigo-400 bg-indigo-500/10 scale-105' : 'border-gray-600 hover:border-indigo-400'}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500/5'}
        `}
      >
        <input {...getInputProps()} />
        
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className="relative z-10">
          <div className="relative mb-6">
            <Upload className="mx-auto h-16 w-16 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute inset-0 h-16 w-16 mx-auto text-indigo-400 animate-ping opacity-20 group-hover:opacity-40"></div>
          </div>
          
          <div className="text-2xl font-bold text-white mb-3">
            {isDragActive ? 'Drop your images here' : 'Upload Pinterest Images'}
          </div>
          <p className="text-gray-300 text-lg mb-2">
            Drag and drop images, or click to select files
          </p>
          <p className="text-sm text-gray-400">
            Supports PNG, JPG, JPEG, WebP
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center space-x-3 glass rounded-full px-6 py-3 border border-gray-700/50">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
            <span className="text-indigo-300 font-medium">Uploading images...</span>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">
              Uploaded Images ({files.length})
            </h3>
            <button
              onClick={() => {
                setFiles([]);
                onFilesUpload([]);
              }}
              className="text-sm text-red-400 hover:text-red-300 font-medium px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {files.map((file) => (
              <div key={file.id} className="group card-hover glass rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="relative aspect-square">
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  <button
                    onClick={() => removeFile(file.id)}
                    className="absolute top-3 right-3 bg-red-500/80 backdrop-blur-sm text-white rounded-full p-2 hover:bg-red-500 transition-all hover:scale-110 cursor-pointer shadow-lg hover:shadow-xl"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  
                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border shadow-lg ${
                    file.status === 'pending' ? 'bg-gray-800/80 text-gray-200 border-gray-600' :
                    file.status === 'processing' ? 'bg-blue-800/80 text-blue-200 border-blue-600' :
                    file.status === 'completed' ? 'bg-green-800/80 text-green-200 border-green-600' :
                    'bg-red-800/80 text-red-200 border-red-600'
                  }`}>
                    {file.status}
                  </div>
                  
                  <div className={`absolute top-3 right-12 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm border shadow-lg ${
                    file.promptType === 'outfit' 
                      ? 'bg-blue-500/80 text-blue-100 border-blue-400' 
                      : 'bg-purple-500/80 text-purple-100 border-purple-400'
                  }`}>
                    {file.promptType === 'outfit' ? 'Outfit' : 'Texture'}
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <div className="text-sm font-medium text-white truncate">
                    {file.file.name}
                  </div>
                  
                  {/* Prompt Type Toggle */}
                  <div className="space-y-2">
                    <div className="relative bg-gray-800 border border-gray-600 rounded-lg p-1 flex">
                      <button
                        onClick={() => updatePromptType(file.id, 'outfit')}
                        className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-200 cursor-pointer ${
                          file.promptType === 'outfit'
                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg hover:shadow-xl'
                            : 'text-gray-400 hover:text-gray-300 hover:shadow-md'
                        }`}
                      >
                        Outfit
                      </button>
                      <button
                        onClick={() => updatePromptType(file.id, 'texture')}
                        className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-200 cursor-pointer ${
                          file.promptType === 'texture'
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg hover:shadow-xl'
                            : 'text-gray-400 hover:text-gray-300 hover:shadow-md'
                        }`}
                      >
                        Texture
                      </button>
                    </div>
                  </div>

                  {/* Gender Toggle - Only show for outfit type */}
                  {file.promptType === 'outfit' && (
                    <div className="space-y-2">
                      <div className="relative bg-gray-800 border border-gray-600 rounded-lg p-1 flex">
                        <button
                          onClick={() => updateGenderType(file.id, 'female')}
                          className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-200 cursor-pointer ${
                            file.genderType === 'female'
                              ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-lg hover:shadow-xl'
                              : 'text-gray-400 hover:text-gray-300 hover:shadow-md'
                          }`}
                        >
                          Female
                        </button>
                        <button
                          onClick={() => updateGenderType(file.id, 'male')}
                          className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-200 cursor-pointer ${
                            file.genderType === 'male'
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg hover:shadow-xl'
                              : 'text-gray-400 hover:text-gray-300 hover:shadow-md'
                          }`}
                        >
                          Male
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Focus on Dropdown */}
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 font-medium">Focus on</div>
                    <select
                      value={file.clothingPart}
                      onChange={(e) => updateClothingPart(file.id, e.target.value as ClothingPart)}
                      className="w-full text-sm bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    >
                      {CLOTHING_PARTS.map((part) => (
                        <option key={part.value} value={part.value} className="bg-gray-800">
                          {part.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {file.clothingPart === 'other' && (
                    <input
                      type="text"
                      placeholder="Enter custom clothing part..."
                      value={file.customClothingPart || ''}
                      onChange={(e) => updateCustomClothingPart(file.id, e.target.value)}
                      className="w-full text-sm bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  )}

                  {/* Additional Guidance Field */}
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 font-medium">Additional Guidance (Optional)</div>
                    <input
                      type="text"
                      placeholder="e.g., blue colors, casual style, winter season..."
                      value={file.guidance || ''}
                      onChange={(e) => updateGuidance(file.id, e.target.value)}
                      className="w-full text-sm bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}