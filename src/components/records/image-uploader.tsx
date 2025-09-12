
"use client";

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon, Upload, Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

const MAX_FILE_SIZE_MB = 2;

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void;
  initialImageUrl?: string;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

const getCroppedImg = (image: HTMLImageElement, crop: Crop): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            
            canvas.width = Math.floor(crop.width * scaleX);
            canvas.height = Math.floor(crop.height * scaleY);
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }

            ctx.drawImage(
                image,
                crop.x * scaleX,
                crop.y * scaleY,
                crop.width * scaleX,
                crop.height * scaleY,
                0,
                0,
                canvas.width,
                canvas.height
            );
            
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas is empty.'));
                    }
                    resolve(blob);
                },
                'image/jpeg',
                0.8
            );
        } catch (e) {
            reject(e);
        }
    });
};


export default function ImageUploader({ onUploadComplete, initialImageUrl }: ImageUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [aspect] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(initialImageUrl);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `Please select an image smaller than ${MAX_FILE_SIZE_MB}MB.`,
          variant: "destructive",
        });
        return;
      }
      setCrop(undefined); // Reset crop on new image
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  };

  const handleUpload = async () => {
    if (!completedCrop || !imgRef.current) {
      toast({ title: "Crop Error", description: "Please select a crop area first.", variant: "destructive" });
      return;
    }
    
    if (!user || !user.distributorId || !user.uid) {
      toast({ title: "Authentication Error", description: "You must be associated with a distributor to upload images.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      if (!croppedBlob) {
        throw new Error("Failed to create cropped image blob.");
      }

      const fileName = `${new Date().getTime()}-${Math.random().toString(36).substring(2)}.jpg`;
      const filePath = `covers/${user.distributorId}/${user.uid}/${fileName}`;
      const storageRef = ref(storage, filePath);
      
      const snapshot = await uploadBytes(storageRef, croppedBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setUploadedImageUrl(downloadURL);
      onUploadComplete(downloadURL);
      setImgSrc('');
      toast({ title: "Upload Successful", description: "Your cover image has been uploaded." });

    } catch (error: any) {
        console.error("An error occurred during the upload process:", error);
        toast({ 
            title: "Upload Failed", 
            description: `An error occurred: ${error.message || "Please check the console for details."}`, 
            variant: "destructive",
            duration: 9000
        });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleRemoveImage = () => {
    setUploadedImageUrl(undefined);
    onUploadComplete(""); 
  };


  if (uploadedImageUrl) {
    return (
      <div className="relative w-48 h-48">
        <Image src={uploadedImageUrl} alt="Uploaded cover" layout="fill" className="rounded-md object-cover" />
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
          onClick={handleRemoveImage}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (imgSrc) {
    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspect}
          minWidth={100}
        >
          <Image
            ref={imgRef}
            alt="Crop me"
            src={imgSrc}
            onLoad={onImageLoad}
            width={400}
            height={400}
            className="max-h-96 w-auto object-contain"
          />
        </ReactCrop>
        <div className="flex gap-2">
          <Button onClick={handleUpload} disabled={isLoading} className="flex-1">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Cropped Image
          </Button>
          <Button variant="outline" onClick={() => setImgSrc('')} disabled={isLoading}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-colors"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={onSelectFile}
        className="hidden"
      />
      <ImageIcon className="h-12 w-12 text-muted-foreground" />
      <p className="mt-2 text-sm font-semibold text-foreground">Click to upload cover art</p>
      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to {MAX_FILE_SIZE_MB}MB</p>
    </div>
  );
}
