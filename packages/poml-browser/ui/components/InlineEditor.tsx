import React, { useState } from 'react';
import { Box, Button, Group, Textarea } from '@mantine/core';

interface InlineEditorProps {
  onSave: (content: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

export const InlineEditor: React.FC<InlineEditorProps> = ({
  onSave,
  onCancel,
  placeholder = 'Enter your content here...',
}) => {
  const [content, setContent] = useState('');

  const handleOk = () => {
    if (content.trim()) {
      onSave(content.trim());
    } else {
      onCancel();
    }
  };

  const handleCancel = () => {
    setContent('');
    onCancel();
  };

  return (
    <Box my='md' p='md' style={{ border: '2px dashed #e0e0e0', borderRadius: '8px' }}>
      <Textarea
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        minRows={3}
        autosize
        mb='sm'
        autoFocus
      />
      <Group justify='flex-end'>
        <Button variant='outline' size='xs' onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant='filled' size='xs' onClick={handleOk}>
          OK
        </Button>
      </Group>
    </Box>
  );
};

export default InlineEditor;
