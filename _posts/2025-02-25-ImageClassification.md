---
layout: post
title:  "Image Classification"
date:   2025-02-25 01:59:33 +0900
categories: jekyll update
---
# Image Classification

**input**: image

![image.png](%E1%84%8C%E1%85%A6%E1%84%86%E1%85%A9%E1%86%A8%20%E1%84%8B%E1%85%A5%E1%86%B9%E1%84%8B%E1%85%B3%E1%86%B7%201a464b49932e80578f34f2797bf4ee17/image.png)

➡️

**output**: classes

**cat**

bird

car

dog

이미지를 입력받아 해당 카테고리를 출력

![image.png](%E1%84%8C%E1%85%A6%E1%84%86%E1%85%A9%E1%86%A8%20%E1%84%8B%E1%85%A5%E1%86%B9%E1%84%8B%E1%85%B3%E1%86%B7%201a464b49932e80578f34f2797bf4ee17/image%201.png)

Object Detection에도 활용

# Hyperparameters

![image.png](%E1%84%8C%E1%85%A6%E1%84%86%E1%85%A9%E1%86%A8%20%E1%84%8B%E1%85%A5%E1%86%B9%E1%84%8B%E1%85%B3%E1%86%B7%201a464b49932e80578f34f2797bf4ee17/image%202.png)

- 사전에 미리 정하는 parameter
- 학습을 통해 학습하거나 갱신되지 않음(↔parameter - weight 등)
- 상황에 따라 설계자가 판단하여 설정
- 학습 시간, 모델 성능 등에 영향을 줌
- learning rate, weight decay 등

# Setting Hyperparameters

![image.png](%E1%84%8C%E1%85%A6%E1%84%86%E1%85%A9%E1%86%A8%20%E1%84%8B%E1%85%A5%E1%86%B9%E1%84%8B%E1%85%B3%E1%86%B7%201a464b49932e80578f34f2797bf4ee17/image%203.png)

- 학습 결과를 통해 조절
- Datasets: train, validation, test
- train: 학습을 수행하는 데이터
- validation: train data의 결과와 비교하여 모델의 성능을 판단, hyperparameter 조절을 통해 성능 향상
- test: 완성된 모델에 적용하여 성능을 평가. validation과 달리 결과를 학습에 적용시키지 않는다.
