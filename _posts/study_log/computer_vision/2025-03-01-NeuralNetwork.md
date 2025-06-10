---
title: (vision)3. Neural Network
post_order: 3
thumbnail: https://www.ibm.com/content/dam/connectedassets-adobe-cms/worldwide-content/cdp/cf/ul/g/3a/b8/ICLH_Diagram_Batch_01_03-DeepNeuralNetwork.png
layout: post
author: jhj
categories:
  - StudyLog
  - ComputerVision
tags:
  - image_classification
  - vision
  - deep_learning
excerpt: 신경망 기초 이론
project_rank: "680"
sticker: emoji//1f4aa
---

# Perceptron(퍼셉트론)

## 선형 결합

![출처: 모두의 딥러닝](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image.png)

출처: 모두의 딥러닝

- 신경망(딥러닝)의 기원이 되는 알고리즘
- 인간의 신경망을 모방(했다고함)
- 다수의 신호 → 하나의 출력
- 입력층에 가중치(w) 곱한 후 더함 → 각 노드의 영향력 조절

## 기하학적 의미

![출처: 아무리봐도 대학교재인데                                                               출처: 위키피디아](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image1.png)

출처: 아무리봐도 대학교재인데                                                               출처: 위키피디아

![image.png](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image2.png)

- 서로 다른 종류를 분류
- 서로 다른 모델들 간의 경계선을 생성

## 선형 결합의 한계와 활성화함수

- 선형 방정식 + 선형 방정식 → 선형 방정식
    - $$
      ax_{1} + bx_{2} + c + dx_{1} + ex_{2} + f = (a+d)x_{1} + (b+e)x_{2} + (c+f)
      $$
    
    - 선형 분류가 어렵거나 복잡한 모델의 분류 어려움
- 활성화 함수를 통해 비선형성 추가
    - Relu, Sigmoid, SVM 등 여러 종류의 활성화 함수가 있음
    - 비전 딥러닝에서 사용하는 활성화 함수는 대부분(사실상 무조건?) Relu 혹은 Relu 변형 함수

![image.png](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image3.png)

## Relu

![image.png](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image4.png)

- 선형 변환을 통해 새로운 분류 모델 생성
- 하지만 변형된 모델도 하나의 선으로 분류가 불가능

![image.png](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image5.png)

- 이후 active function(Relu)를 통해 새롭게 매핑
- 선형 분류 모델 생성 가능

# 신경망

## layer

![출처: LG CNS 블로그 ([https://www.lgcns.com/blog/cns-tech/ai-data/14558/](https://www.lgcns.com/blog/cns-tech/ai-data/14558/))](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image6.png)

출처: LG CNS 블로그 ([https://www.lgcns.com/blog/cns-tech/ai-data/14558/](https://www.lgcns.com/blog/cns-tech/ai-data/14558/))

- 다수의 퍼셉트론을 여러 층으로 생성
- 입력층, 은닉층, 출력층으로 구성
- 입력층
    - 데이터를 읽어오는 층
- 은닉층
    - 입력층과 출력층 사이의 layer
    - 복잡한 데이터를 분류하기 위해 추가되는 layer
- 출력층
    - 최종 출력값이 나오는 층
    - 출력 결과 = **score**
    - 분류하고자 하는 종류(class)의 개수만큼 출력 개수 존재
    - 주로 소프트맥스(softmax)함수를 사용
        - 일종의 함수 개념과 비슷
        - 0-1 사이의 결과값을 도출
        - 해당 class일 확률을 출력하여 어떤 class일지 최종 판단

## Softmax

![출처 : [https://towardsdatascience.com/softmax-activation-function-explained-a7e1bc3ad60](https://towardsdatascience.com/softmax-activation-function-explained-a7e1bc3ad60)](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image7.png)

출처 : [https://towardsdatascience.com/softmax-activation-function-explained-a7e1bc3ad60](https://towardsdatascience.com/softmax-activation-function-explained-a7e1bc3ad60)

![출처 : [https://ljvmiranda921.github.io/notebook/2017/08/13/softmax-and-the-negative-log-likelihood/](https://ljvmiranda921.github.io/notebook/2017/08/13/softmax-and-the-negative-log-likelihood/)](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image8.png)

출처 : [https://ljvmiranda921.github.io/notebook/2017/08/13/softmax-and-the-negative-log-likelihood/](https://ljvmiranda921.github.io/notebook/2017/08/13/softmax-and-the-negative-log-likelihood/)

- score의 모든 값을 지수함수로 normalize
- 왜 지수함수인가?
    - 양수값을 가지기 때문에 비교가 쉬움
    - 큰 값을 가질수록 더 큰 가중치를 가짐

## future tasks

![image.png](/assets/images/study_log/computer_vision/2025-03-01-NeuralNetwork/image9.png)

- 해당 모델의 평가 척도? → loss function
- 가중치(W) 선정 방법? → back propagation & optimization
