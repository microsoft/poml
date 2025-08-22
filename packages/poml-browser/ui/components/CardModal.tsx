import React, { useState, useEffect } from 'react';
import { Modal, Textarea, Button, Group, Text, Badge, Stack } from '@mantine/core';
import { ExtractedContent } from '@functions/types';

interface CardModalProps {
  content: ExtractedContent | null;
  opened: boolean;
  onClose: () => void;
  onSave: (id: string, newContent: string) => void;
}

export const CardModal: React.FC<CardModalProps> = ({ content, opened, onClose, onSave }) => {
  const [editedContent, setEditedContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (content) {
      setEditedContent(content.content);
      setHasChanges(false);
    }
  }, [content]);

  const handleContentChange = (value: string) => {
    setEditedContent(value);
    setHasChanges(value !== content?.content);
  };

  const handleSave = () => {
    if (content && hasChanges) {
      onSave(content.id, editedContent);
      setHasChanges(false);
    }
    onClose();
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmClose) {
        return;
      }
    }
    onClose();
  };

  if (!content) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Stack gap="xs">
          <Text fw={500} size="lg" truncate>
            {content.title}
          </Text>
          {!content.isManual && (
            <Group gap="xs">
              <Badge color="blue" variant="light" size="sm">
                {content.timestamp.toLocaleString()}
              </Badge>
              {content.url && (
                <Text size="xs" c="dimmed" truncate style={{ maxWidth: '400px' }}>
                  {content.url}
                </Text>
              )}
            </Group>
          )}
        </Stack>
      }
      size="100%"
      fullScreen
      transitionProps={{ transition: 'fade', duration: 200 }}
    >
      <Stack gap="md" style={{ height: '100%' }}>
        <Textarea
          value={editedContent}
          onChange={event => handleContentChange(event.currentTarget.value)}
          placeholder="Enter content here..."
          autosize
          minRows={20}
          maxRows={50}
          style={{
            flex: 1,
            '& textarea': {
              minHeight: 'calc(100vh - 200px)',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: 1.5
            }
          }}
        />

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {editedContent.length} characters
          </Text>

          <Group>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              variant={hasChanges ? 'filled' : 'light'}
            >
              {hasChanges ? 'Save Changes' : 'Close'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CardModal;
