import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

// Type definition for uploaded file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import {
  FileUploadDto,
  MultipleFileUploadDto,
  FileUploadResponseDto,
  DeleteFileDto,
} from '../../common/dto/file-upload.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('File Upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  @Post('single')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileUploadDto })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file or upload failed' })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadSingle(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateFile(file);

    try {
      const result = await this.cloudinaryService.uploadFile(file.buffer, {
        folder: this.configService.get('cloudinary.folder'),
        tags: ['single-upload'],
      });

      return {
        success: true,
        message: 'File uploaded successfully',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Post('multiple')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MultipleFileUploadDto })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    type: [FileUploadResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid files or upload failed' })
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  @HttpCode(HttpStatus.CREATED)
  async uploadMultiple(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate all files
    files.forEach((file) => this.validateFile(file));

    try {
      const results = await this.cloudinaryService.uploadMultipleFiles(
        files.map((file) => ({
          buffer: file.buffer,
          originalname: file.originalname,
        })),
        {
          folder: this.configService.get('cloudinary.folder'),
          tags: ['multiple-upload'],
        },
      );

      return {
        success: true,
        message: `${files.length} files uploaded successfully`,
        data: results,
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Post('image')
  @ApiOperation({ summary: 'Upload an image with optimization' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileUploadDto })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded and optimized successfully',
    type: FileUploadResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadImage(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate it's an image
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    this.validateFile(file);

    try {
      const result = await this.cloudinaryService.uploadFile(file.buffer, {
        folder: `${this.configService.get('cloudinary.folder')}/images`,
        resourceType: 'image',
        tags: ['image-upload'],
        transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }],
      });

      return {
        success: true,
        message: 'Image uploaded and optimized successfully',
        data: {
          ...result,
          optimizedUrl: this.cloudinaryService.generateOptimizedUrl(
            result.publicId,
            {
              width: 800,
              quality: 'auto',
              format: 'auto',
            },
          ),
        },
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Delete('file')
  @ApiOperation({ summary: 'Delete a file from Cloudinary' })
  @ApiBody({ type: DeleteFileDto })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 400, description: 'Delete failed' })
  async deleteFile(@Body() deleteFileDto: DeleteFileDto) {
    try {
      const result = await this.cloudinaryService.deleteFile(
        deleteFileDto.publicId,
      );

      return {
        success: true,
        message: 'File deleted successfully',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(`Delete failed: ${error.message}`);
    }
  }

  @Get('details/:publicId')
  @ApiOperation({ summary: 'Get file details' })
  @ApiParam({ name: 'publicId', description: 'Public ID of the file' })
  @ApiResponse({ status: 200, description: 'File details retrieved' })
  async getFileDetails(@Param('publicId') publicId: string) {
    try {
      // Decode the publicId if it's URL encoded
      const decodedPublicId = decodeURIComponent(publicId);
      const details =
        await this.cloudinaryService.getFileDetails(decodedPublicId);

      return {
        success: true,
        data: details,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get file details: ${error.message}`,
      );
    }
  }

  private validateFile(file: MulterFile) {
    const maxSize = this.configService.get('cloudinary.maxFileSize');
    const allowedFormats = this.configService.get('cloudinary.allowedFormats');

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSize / 1024 / 1024}MB`,
      );
    }

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExtension && !allowedFormats.includes(fileExtension)) {
      throw new BadRequestException(
        `File format not allowed. Allowed formats: ${allowedFormats.join(', ')}`,
      );
    }
  }
}
