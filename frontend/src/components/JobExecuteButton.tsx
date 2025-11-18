import React, { useState } from 'react';
import { Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { jobsApi } from '../api/services';
import type { XxlJob } from '../types/api';

const { TextArea } = Input;

/**
 * Job Execute Button Component
 * Provides UI controls for triggering, starting, and stopping xxl-job tasks
 * Handles permission-based visibility (buttons are only visible if user has permission)
 */

interface JobExecuteButtonProps {
  job: XxlJob;
  onSuccess?: () => void;
  type?: 'trigger' | 'start' | 'stop';
}

export const JobExecuteButton: React.FC<JobExecuteButtonProps> = ({
  job,
  onSuccess,
  type = 'trigger',
}) => {
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [triggerForm] = Form.useForm();

  const handleTrigger = () => {
    setTriggerModalVisible(true);
    triggerForm.setFieldsValue({ executorParam: job.executorParam || '' });
  };

  const handleTriggerConfirm = async () => {
    try {
      setLoading(true);
      const values = await triggerForm.validateFields();
      await jobsApi.trigger(job.id, {
        executorParam: values.executorParam || undefined,
        addressList: values.addressList || undefined,
      });
      message.success(`Job "${job.jobDesc}" triggered successfully`);
      setTriggerModalVisible(false);
      triggerForm.resetFields();
      onSuccess?.();
    } catch (error: any) {
      if (error.response) {
        message.error(
          'Failed to trigger job: ' + (error.response?.data?.message || error.message)
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      await jobsApi.start(job.id);
      message.success(`Job "${job.jobDesc}" started successfully`);
      onSuccess?.();
    } catch (error: any) {
      message.error('Failed to start job: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setLoading(true);
      await jobsApi.stop(job.id);
      message.success(`Job "${job.jobDesc}" stopped successfully`);
      onSuccess?.();
    } catch (error: any) {
      message.error('Failed to stop job: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (type === 'trigger') {
    return (
      <>
        <Button
          type="link"
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={handleTrigger}
          loading={loading}
          data-testid="trigger-button"
        >
          Trigger
        </Button>

        <Modal
          title={`Trigger Job: ${job.jobDesc}`}
          open={triggerModalVisible}
          onOk={handleTriggerConfirm}
          onCancel={() => {
            setTriggerModalVisible(false);
            triggerForm.resetFields();
          }}
          okText="Trigger"
          confirmLoading={loading}
          data-testid="trigger-modal"
        >
          <Form form={triggerForm} layout="vertical">
            <Form.Item
              label="Executor Parameter"
              name="executorParam"
              tooltip="Optional parameter to pass to the executor"
            >
              <TextArea rows={3} placeholder="Enter executor parameter (optional)" />
            </Form.Item>
            <Form.Item
              label="Address List"
              name="addressList"
              tooltip="Optional comma-separated list of executor addresses"
            >
              <Input placeholder="e.g., 192.168.1.1:9999,192.168.1.2:9999" />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  }

  if (type === 'start') {
    return (
      <Popconfirm
        title="Start this job?"
        onConfirm={handleStart}
        okText="Yes"
        cancelText="No"
      >
        <Button
          type="link"
          size="small"
          icon={<PlayCircleOutlined />}
          loading={loading}
          data-testid="start-button"
        >
          Start
        </Button>
      </Popconfirm>
    );
  }

  if (type === 'stop') {
    return (
      <Popconfirm
        title="Stop this job?"
        onConfirm={handleStop}
        okText="Yes"
        cancelText="No"
      >
        <Button
          type="link"
          size="small"
          danger
          icon={<PauseCircleOutlined />}
          loading={loading}
          data-testid="stop-button"
        >
          Stop
        </Button>
      </Popconfirm>
    );
  }

  return null;
};

export default JobExecuteButton;
